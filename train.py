'''
train.py - Full Model Training Pipeline
'''

import argparse
import json
import pickle
import sys
import warnings
from pathlib import Path
from typing import Dict, Tuple, Any

import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')

REPO_ROOT = Path(__file__).parent
DATA_CSV_DEFAULT = Path(r'c:\Users\Sanjana\Downloads\sih26080_v2\sih26080_v2\data.injected.csv')
MODELS_DIR = REPO_ROOT / 'models_store'
DATA_SPLITS_DIR = REPO_ROOT / 'data' / 'splits'
MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATA_SPLITS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLS = [
    'latitude', 'longitude', 'elevation_m', 'lead_time_hours',
    'nwp_rainfall_mm', 'nwp_temperature_c', 'relative_humidity',
    'specific_humidity', 'wind_speed_ms', 'surface_pressure_hpa',
    'vertical_velocity_pa_s', 'sea_surface_temperature_c', 'sst_anomaly_c',
    'mjo_phase', 'enso_index', 'iod_index',
    'orographic_factor', 'coastal_distance_km',
    'monsoon_month', 'forecast_year',
]

REGIME_COL = 'regime'
TARGET_COL = 'observed_rainfall_mm'
NWP_COL = 'nwp_rainfall_mm'
YEAR_COL = 'forecast_year'

REGIME_LABELS = [
    'active_monsoon', 'break_monsoon', 'monsoon_low_depression',
    'coastal_orographic', 'western_disturbance',
]

THRESH_HEAVY = 64.5
THRESH_VERY_HEAVY = 115.5
THRESH_EXTREME = 204.4


def load_and_validate(csv_path):
    print(f'[Step 1] Loading CSV from: {csv_path}')
    df = pd.read_csv(csv_path)
    print(f'  Rows: {len(df):,} | Columns: {len(df.columns)}')
    assert len(df) >= 1000, 'Dataset too small'
    assert TARGET_COL in df.columns, f'Missing {TARGET_COL}'
    assert REGIME_COL in df.columns, f'Missing {REGIME_COL}'
    print(df[REGIME_COL].value_counts().to_string())
    print(f'  Year range: {df[YEAR_COL].min()} - {df[YEAR_COL].max()}')
    print(f'  Target: min={df[TARGET_COL].min():.2f}, max={df[TARGET_COL].max():.2f}')
    print('[Step 1] OK')
    return df


def build_splits(df):
    print('[Step 2] Building time-blocked splits...')
    train_years = list(range(2010, 2021))
    val_years = list(range(2021, 2024))
    test_years = list(range(2024, 2026))
    df_year = pd.to_numeric(df[YEAR_COL], errors='coerce')
    df_train = df[df_year.isin(train_years)].copy()
    df_val = df[df_year.isin(val_years)].copy()
    df_test = df[df_year.isin(test_years)].copy()
    print(f'  Train: {len(df_train):,} | Val: {len(df_val):,} | Test: {len(df_test):,}')
    summary = {'train_count': len(df_train), 'val_count': len(df_val), 'test_count': len(df_test)}
    with open(DATA_SPLITS_DIR / 'split_indices.json', 'w') as f:
        json.dump(summary, f, indent=2)
    if len(df_train) < 500 or len(df_val) < 200 or len(df_test) < 200:
        print('  Fallback to 70/15/15 sequential split')
        n = len(df)
        df_train = df.iloc[:int(n*0.70)].copy()
        df_val = df.iloc[int(n*0.70):int(n*0.85)].copy()
        df_test = df.iloc[int(n*0.85):].copy()
    print('[Step 2] OK')
    return df_train, df_val, df_test


def get_X(df):
    cols = [c for c in FEATURE_COLS if c in df.columns]
    return df[cols].apply(pd.to_numeric, errors='coerce').fillna(0.0)

def get_y(df):
    return pd.to_numeric(df[TARGET_COL], errors='coerce').fillna(0.0)

def get_regime(df):
    return df[REGIME_COL].fillna('active_monsoon')


def train_regime_classifier(df_train, df_val, use_lgbm=True):
    print('[Step 3] Training Regime Classifier...')
    from sklearn.preprocessing import LabelEncoder
    from sklearn.metrics import accuracy_score, classification_report
    le = LabelEncoder()
    le.fit(REGIME_LABELS)
    def encode(s):
        return le.transform([x if x in REGIME_LABELS else 'active_monsoon' for x in s])
    X_tr, X_v = get_X(df_train), get_X(df_val)
    y_tr = encode(get_regime(df_train))
    y_v = encode(get_regime(df_val))
    model = None
    if use_lgbm:
        try:
            import lightgbm as lgb
            model = lgb.LGBMClassifier(
                objective='multiclass', num_class=len(REGIME_LABELS),
                n_estimators=300, learning_rate=0.05, num_leaves=63,
                max_depth=6, min_child_samples=30, subsample=0.85,
                colsample_bytree=0.85, random_state=42, verbose=-1)
            model.fit(X_tr, y_tr, eval_set=[(X_v, y_v)],
                callbacks=[lgb.early_stopping(50,verbose=False), lgb.log_evaluation(-1)])
            print('  Using LightGBM')
        except Exception as e:
            print(f'  LightGBM failed: {e}')
            model = None
    if model is None:
        from sklearn.ensemble import RandomForestClassifier
        model = RandomForestClassifier(n_estimators=200, max_depth=10, min_samples_leaf=20, random_state=42, n_jobs=-1)
        model.fit(X_tr, y_tr)
        print('  Using RandomForest')
    y_pred = model.predict(X_v)
    print(f'  Accuracy: {accuracy_score(y_v, y_pred):.4f}')
    print(classification_report(y_v, y_pred, target_names=le.classes_, zero_division=0))
    artifact = {'model': model, 'label_encoder': le, 'feature_cols': list(X_tr.columns)}
    with open(MODELS_DIR / 'regime_classifier.pkl', 'wb') as f:
        pickle.dump(artifact, f)
    print('[Step 3] OK  ->', MODELS_DIR / 'regime_classifier.pkl')
    return artifact


def train_bias_correctors(df_train, df_val, use_lgbm=True):
    print('[Step 4] Training Bias-Correction models per regime...')
    results = {}
    for regime in REGIME_LABELS:
        dfr_tr = df_train[df_train[REGIME_COL] == regime]
        dfr_v  = df_val[df_val[REGIME_COL] == regime]
        if len(dfr_tr) < 50:
            print(f'  [{regime}] skipped ({len(dfr_tr)} rows)')
            continue
        X_tr, y_tr = get_X(dfr_tr), get_y(dfr_tr)
        X_v, y_v   = get_X(dfr_v), get_y(dfr_v)
        print(f'  [{regime}] n_train={len(X_tr):,}')
        model = None
        model_q10 = model_q90 = None
        if use_lgbm:
            try:
                import lightgbm as lgb
                model = lgb.LGBMRegressor(
                    objective='regression', n_estimators=200, learning_rate=0.05,
                    num_leaves=31, max_depth=5, min_child_samples=20,
                    subsample=0.85, colsample_bytree=0.8, random_state=42, verbose=-1)
                model.fit(X_tr, y_tr)
                if regime in ('active_monsoon', 'break_monsoon'):
                    model_q10 = lgb.LGBMRegressor(objective='quantile', alpha=0.10, n_estimators=150, learning_rate=0.08, num_leaves=31, max_depth=4, random_state=42, verbose=-1)
                    model_q10.fit(X_tr, y_tr)
                    model_q90 = lgb.LGBMRegressor(objective='quantile', alpha=0.90, n_estimators=150, learning_rate=0.08, num_leaves=31, max_depth=4, random_state=42, verbose=-1)
                    model_q90.fit(X_tr, y_tr)
            except Exception as e:
                print(f'    lgbm failed: {e}')
                model = None
        if model is None:
            from sklearn.ensemble import GradientBoostingRegressor
            model = GradientBoostingRegressor(n_estimators=150, learning_rate=0.08, max_depth=4, min_samples_leaf=20, subsample=0.8, random_state=42)
            model.fit(X_tr, y_tr)
        if len(X_v) > 0:
            yp = np.clip(model.predict(X_v), 0, None)
            rmse_c = float(np.sqrt(np.mean((yp - y_v.values)**2)))
            nwp_v = pd.to_numeric(dfr_v[NWP_COL], errors='coerce').fillna(0).values
            rmse_n = float(np.sqrt(np.mean((nwp_v - y_v.values)**2)))
            print(f'    RMSE corrected={rmse_c:.3f}  raw_nwp={rmse_n:.3f}  delta={rmse_n-rmse_c:.3f}')
        else:
            rmse_c = rmse_n = float('nan')
        results[regime] = {'model': model, 'model_q10': model_q10, 'model_q90': model_q90,
            'regime': regime, 'feature_cols': list(X_tr.columns), 'val_rmse': rmse_c, 'nwp_rmse': rmse_n}
    with open(MODELS_DIR / 'bias_correctors.pkl', 'wb') as f:
        pickle.dump(results, f)
    print('[Step 4] OK  ->', MODELS_DIR / 'bias_correctors.pkl')
    return results


def train_probability_calibrator(df_train, df_val, use_lgbm=True):
    print('[Step 5] Training Probability Calibrators...')
    X_tr, X_v = get_X(df_train), get_X(df_val)
    y_tr, y_v = get_y(df_train), get_y(df_val)
    thresholds = {'heavy': THRESH_HEAVY, 'very_heavy': THRESH_VERY_HEAVY, 'extreme': THRESH_EXTREME}
    calibrators = {}
    for label, thresh in thresholds.items():
        yb_tr = (y_tr >= thresh).astype(int)
        yb_v  = (y_v  >= thresh).astype(int)
        print(f'  [{label}>={thresh}mm] events={yb_tr.sum()} ({yb_tr.mean():.4f})')
        if yb_tr.sum() < 20:
            calibrators[label] = None
            continue
        clf = None
        if use_lgbm:
            try:
                import lightgbm as lgb
                clf = lgb.LGBMClassifier(objective='binary', n_estimators=200, learning_rate=0.05,
                    num_leaves=31, max_depth=5, min_child_samples=20, is_unbalance=True, random_state=42, verbose=-1)
                clf.fit(X_tr, yb_tr)
            except Exception as e:
                print(f'    lgbm failed: {e}')
                clf = None
        if clf is None:
            from sklearn.ensemble import GradientBoostingClassifier
            clf = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42)
            clf.fit(X_tr, yb_tr)
        try:
            from sklearn.calibration import CalibratedClassifierCV
            cal = CalibratedClassifierCV(clf, method='isotonic', cv=3)
            cal.fit(X_tr, yb_tr)
        except Exception:
            cal = clf
        if len(X_v) > 0 and yb_v.sum() > 0:
            from sklearn.metrics import roc_auc_score, brier_score_loss
            try:
                p = cal.predict_proba(X_v)[:,1]
                print(f'    AUC={roc_auc_score(yb_v, p):.4f}  Brier={brier_score_loss(yb_v, p):.4f}')
            except Exception:
                pass
        calibrators[label] = cal
    with open(MODELS_DIR / 'probability_calibrators.pkl', 'wb') as f:
        pickle.dump({'calibrators': calibrators, 'thresholds': thresholds, 'feature_cols': list(X_tr.columns)}, f)
    print('[Step 5] OK  ->', MODELS_DIR / 'probability_calibrators.pkl')
    return calibrators


def compute_scorecard(df_test, bias_correctors, regime_clf_artifact):
    print('[Step 6] Computing Verification Scorecard...')
    if len(df_test) == 0:
        print('  WARNING: empty test set')
        return {}
    X_test = get_X(df_test)
    y_obs  = get_y(df_test).values
    nwp_raw = pd.to_numeric(df_test[NWP_COL], errors='coerce').fillna(0).values
    regime_true = df_test[REGIME_COL].values
    corrected = nwp_raw.copy()
    for regime, art in bias_correctors.items():
        if art is None: continue
        mask = regime_true == regime
        if mask.sum() == 0: continue
        corrected[mask] = np.clip(art['model'].predict(X_test[mask]), 0, None)
    def rmse(a, b): return float(np.sqrt(np.mean((a-b)**2)))
    def scores(obs, fcst, thresh):
        op = obs>=thresh; fp = fcst>=thresh
        h,m,fa = float(np.sum(op&fp)), float(np.sum(op&~fp)), float(np.sum(~op&fp))
        n = len(obs)
        hr = ((h+m)*(h+fa))/max(n,1)
        ets = (h-hr)/max(h+m+fa-hr,1e-9)
        return {'ets':round(ets,4),'csi':round(h/max(h+m+fa,1e-9),4),'pod':round(h/max(h+m,1e-9),4),'far':round(fa/max(h+fa,1e-9),4)}
    rn = rmse(y_obs,nwp_raw); rc = rmse(y_obs,corrected)
    print(f'  RMSE raw={rn:.3f}  corrected={rc:.3f}  delta={rn-rc:.3f} ({(rn-rc)/max(rn,1e-9)*100:.1f}%)')
    sc = {}
    for lbl,th in [('heavy',THRESH_HEAVY),('very_heavy',THRESH_VERY_HEAVY)]:
        sn,ss = scores(y_obs,nwp_raw,th), scores(y_obs,corrected,th)
        print(f'  [{lbl}] NWP: {sn}  Corrected: {ss}')
        sc[lbl] = {'nwp':sn,'corrected':ss}
    per_regime = {}
    for regime in REGIME_LABELS:
        mask = regime_true==regime
        if mask.sum()<5: continue
        rn2 = rmse(y_obs[mask],nwp_raw[mask]); rc2 = rmse(y_obs[mask],corrected[mask])
        per_regime[regime] = {'nwp_rmse':rn2,'corrected_rmse':rc2}
        print(f'  {regime:<30} raw={rn2:.3f}  corr={rc2:.3f}  delta={rn2-rc2:.3f}')
    out = {'overall_rmse_nwp':rn,'overall_rmse_corrected':rc,'rmse_reduction_mm':rn-rc,
        'rmse_reduction_pct':(rn-rc)/max(rn,1e-9)*100,'threshold_scores':sc,'per_regime_rmse':per_regime}
    with open(MODELS_DIR/'verification_scorecard.json','w') as f:
        json.dump(out,f,indent=2)
    print('[Step 6] OK  ->', MODELS_DIR/'verification_scorecard.json')
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', default=str(DATA_CSV_DEFAULT))
    parser.add_argument('--no-lgbm', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f'ERROR: CSV not found at {csv_path}')
        sys.exit(1)
    use_lgbm = not args.no_lgbm
    print('='*72)
    print('  Regime-Aware AI Rainfall Post-Processing - Training Pipeline')
    print('='*72)
    df = load_and_validate(csv_path)
    if args.dry_run:
        print('DRY-RUN complete.')
        return
    df_train, df_val, df_test = build_splits(df)
    clf = train_regime_classifier(df_train, df_val, use_lgbm)
    bc  = train_bias_correctors(df_train, df_val, use_lgbm)
    train_probability_calibrator(df_train, df_val, use_lgbm)
    sc = compute_scorecard(df_test, bc, clf)
    manifest = {'system':'Regime-Aware AI Rainfall Post-Processing MVP',
        'models':{
            'regime_classifier':str(MODELS_DIR/'regime_classifier.pkl'),
            'bias_correctors':str(MODELS_DIR/'bias_correctors.pkl'),
            'probability_calibrators':str(MODELS_DIR/'probability_calibrators.pkl'),
        },'verification_scorecard':str(MODELS_DIR/'verification_scorecard.json'),
        'overall_rmse_nwp':sc.get('overall_rmse_nwp'),
        'overall_rmse_corrected':sc.get('overall_rmse_corrected'),
        'rmse_reduction_pct':sc.get('rmse_reduction_pct')}
    with open(MODELS_DIR/'manifest.json','w') as f:
        json.dump(manifest,f,indent=2)
    print('='*72)
    print('  Training pipeline complete!')
    print(f'  Models: {MODELS_DIR}')
    print('='*72)

if __name__ == '__main__':
    main()
