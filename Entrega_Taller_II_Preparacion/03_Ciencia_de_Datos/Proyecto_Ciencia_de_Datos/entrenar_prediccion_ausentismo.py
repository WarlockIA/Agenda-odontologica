from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "exportacion_bd" / "simulacion_2026-08-23_a_2026-11-16" / "csv"
ARTIFACT_DIR = BASE_DIR / "modelos"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

appointments = pd.read_csv(DATA_DIR / "appointments.csv")
patients = pd.read_csv(DATA_DIR / "patients.csv")
treatments = pd.read_csv(DATA_DIR / "treatments.csv")
appointment_treatments = pd.read_csv(DATA_DIR / "appointment_treatments.csv")

appointments["es_sintetico"] = (
    appointments["es_sintetico"].astype(str).str.lower().eq("true")
)
patients["es_sintetico"] = patients["es_sintetico"].astype(str).str.lower().eq("true")
treatments["es_sintetico"] = treatments["es_sintetico"].astype(str).str.lower().eq("true")
appointment_treatments["es_sintetico"] = (
    appointment_treatments["es_sintetico"].astype(str).str.lower().eq("true")
)

appointments["appointment_date"] = pd.to_datetime(
    appointments["appointment_date"], errors="coerce"
)
appointment_treatments["costo_aplicado"] = pd.to_numeric(
    appointment_treatments["costo_aplicado"], errors="coerce"
)

synthetic = appointments.loc[
    appointments["es_sintetico"]
    & appointments["status"].isin(["Atendida", "Ausente"])
].copy()

patient_features = patients[["id", "edad", "sexo"]].rename(
    columns={"id": "patient_id", "edad": "edad", "sexo": "sexo"}
)
links = appointment_treatments.loc[
    appointment_treatments["es_sintetico"]
].merge(
    treatments[["id", "categoria", "costo_base"]],
    left_on="treatment_id",
    right_on="id",
    how="left",
)
links = links.groupby("appointment_id", as_index=False).agg(
    costo_aplicado=("costo_aplicado", "max"),
    costo_base=("costo_base", "max"),
    categorias=("categoria", lambda values: "|".join(sorted(set(values.dropna())))),
)

data = synthetic.merge(patient_features, on="patient_id", how="left")
data = data.merge(
    links,
    left_on="id",
    right_on="appointment_id",
    how="left",
)

data["appointment_datetime"] = pd.to_datetime(
    data["appointment_date"].dt.strftime("%Y-%m-%d") + " " + data["appointment_time"],
    errors="coerce",
)
data = data.sort_values(["appointment_datetime", "id"]).reset_index(drop=True)

data["ausente"] = data["status"].eq("Ausente").astype(int)
data["dia_semana"] = data["appointment_datetime"].dt.dayofweek
data["mes"] = data["appointment_datetime"].dt.month
data["hora"] = (
    data["appointment_datetime"].dt.hour
    + data["appointment_datetime"].dt.minute / 60
)
data["costo"] = data["costo_aplicado"].fillna(data["costo_base"])
data["edad"] = pd.to_numeric(data["edad"], errors="coerce")

data["citas_previas"] = data.groupby("patient_id").cumcount()
data["ausencias_previas"] = (
    data.groupby("patient_id")["ausente"].cumsum().shift(fill_value=0)
)
data["atenciones_previas"] = data.groupby("patient_id")["ausente"].apply(
    lambda values: values.eq(0).cumsum().shift(fill_value=0)
).reset_index(level=0, drop=True)
data["tasa_ausencia_previa"] = (
    data["ausencias_previas"] / data["citas_previas"].replace(0, np.nan)
).fillna(0)

last_appointment = data.groupby("patient_id")["appointment_datetime"].shift()
data["dias_desde_cita_anterior"] = (
    data["appointment_datetime"] - last_appointment
).dt.total_seconds().div(86400)

feature_columns = [
    "dia_semana",
    "mes",
    "hora",
    "edad",
    "sexo",
    "treatment",
    "categorias",
    "costo",
    "citas_previas",
    "ausencias_previas",
    "atenciones_previas",
    "tasa_ausencia_previa",
    "dias_desde_cita_anterior",
]
model_data = data[feature_columns + ["ausente", "status", "appointment_datetime"]].dropna(
    subset=["appointment_datetime", "ausente"]
)

split_at = int(len(model_data) * 0.80)
train = model_data.iloc[:split_at].copy()
test = model_data.iloc[split_at:].copy()

X_train = train[feature_columns]
y_train = train["ausente"]
X_test = test[feature_columns]
y_test = test["ausente"]

categorical = ["sexo", "treatment", "categorias"]
numeric = [column for column in feature_columns if column not in categorical]

numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])
categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore")),
])

preprocessor = ColumnTransformer([
    ("numeric", numeric_pipeline, numeric),
    ("categorical", categorical_pipeline, categorical),
])

models = {
    "regresion_logistica": LogisticRegression(
        class_weight="balanced",
        max_iter=2000,
        random_state=42,
    ),
    "random_forest": RandomForestClassifier(
        n_estimators=300,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    ),
}

results = {}
for name, classifier in models.items():
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", classifier),
    ])
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    probabilities = pipeline.predict_proba(X_test)[:, 1]

    results[name] = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, predictions)),
        "precision": float(precision_score(y_test, predictions, zero_division=0)),
        "recall": float(recall_score(y_test, predictions, zero_division=0)),
        "f1": float(f1_score(y_test, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
        "classification_report": classification_report(
            y_test, predictions, target_names=["Atendida", "Ausente"], zero_division=0
        ),
    }
    joblib.dump(pipeline, ARTIFACT_DIR / f"{name}.joblib")

logistic_pipeline = joblib.load(ARTIFACT_DIR / "regresion_logistica.joblib")
preprocessor = logistic_pipeline.named_steps["preprocessor"]
classifier = logistic_pipeline.named_steps["classifier"]
numeric_pipeline = preprocessor.named_transformers_["numeric"]
categorical_pipeline = preprocessor.named_transformers_["categorical"]

if classifier.classes_.tolist() != [0, 1]:
    raise ValueError("La exportación para la aplicación requiere las clases 0 y 1.")

inference_model = {
    "model": "regresion_logistica",
    "positiveClass": 1,
    "numericFeatures": {
        "names": list(preprocessor.transformers_[0][2]),
        "medians": numeric_pipeline.named_steps["imputer"].statistics_.tolist(),
        "means": numeric_pipeline.named_steps["scaler"].mean_.tolist(),
        "scales": numeric_pipeline.named_steps["scaler"].scale_.tolist(),
    },
    "categoricalFeatures": {
        "names": list(preprocessor.transformers_[1][2]),
        "imputers": [
            str(value)
            for value in categorical_pipeline.named_steps["imputer"].statistics_
        ],
        "categories": [
            [str(value) for value in categories]
            for categories in categorical_pipeline.named_steps["encoder"].categories_
        ],
    },
    "coefficients": classifier.coef_[0].tolist(),
    "intercept": float(classifier.intercept_[0]),
}
with (ARTIFACT_DIR / "regresion_logistica_node.json").open("w", encoding="utf-8") as file:
    json.dump(inference_model, file, ensure_ascii=False, indent=2)

def predict_with_exported_parameters(sample):
    score = inference_model["intercept"]
    coefficient_index = 0
    numeric = inference_model["numericFeatures"]

    for index, name in enumerate(numeric["names"]):
        value = sample[name]
        value = numeric["medians"][index] if pd.isna(value) else float(value)
        score += (
            (value - numeric["means"][index]) / numeric["scales"][index]
        ) * inference_model["coefficients"][coefficient_index]
        coefficient_index += 1

    categorical = inference_model["categoricalFeatures"]
    for feature_index, name in enumerate(categorical["names"]):
        value = sample[name]
        value = categorical["imputers"][feature_index] if pd.isna(value) else str(value)
        category_index = categorical["categories"][feature_index].index(value) \
            if value in categorical["categories"][feature_index] else -1
        if category_index >= 0:
            score += inference_model["coefficients"][coefficient_index + category_index]
        coefficient_index += len(categorical["categories"][feature_index])

    return 1 / (1 + np.exp(-np.clip(score, -709, 709)))


expected_probabilities = logistic_pipeline.predict_proba(X_test)[:, 1]
exported_probabilities = np.array([
    predict_with_exported_parameters(sample)
    for sample in X_test.to_dict(orient="records")
])
if not np.allclose(expected_probabilities, exported_probabilities, rtol=1e-10, atol=1e-12):
    raise RuntimeError("El modelo exportado no reproduce las probabilidades del pipeline.")

pd.DataFrame(results).T.to_csv(
    ARTIFACT_DIR / "metricas_modelos.csv", encoding="utf-8-sig"
)
with (ARTIFACT_DIR / "metricas_modelos.json").open("w", encoding="utf-8") as file:
    json.dump(results, file, ensure_ascii=False, indent=2)

prediction_columns = [
    "appointment_datetime",
    "status",
    "ausente",
]
test_predictions = test[prediction_columns].copy()
for name, classifier in models.items():
    pipeline = joblib.load(ARTIFACT_DIR / f"{name}.joblib")
    test_predictions[f"{name}_probabilidad_ausente"] = pipeline.predict_proba(X_test)[:, 1]
    test_predictions[f"{name}_prediccion"] = pipeline.predict(X_test)
test_predictions.to_csv(
    ARTIFACT_DIR / "predicciones_prueba.csv", index=False, encoding="utf-8-sig"
)

print("Citas sintéticas utilizadas:", len(model_data))
print("Entrenamiento:", len(train), "Prueba:", len(test))
print("Fechas de prueba:", test["appointment_datetime"].min(), "a", test["appointment_datetime"].max())
for name, metrics in results.items():
    print(name)
    print({key: value for key, value in metrics.items() if key not in ["classification_report"]})
