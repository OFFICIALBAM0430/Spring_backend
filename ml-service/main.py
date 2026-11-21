import os
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from recommendation import generate_recommendation

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv('MODEL_PATH', BASE_DIR / 'hotel_abandonment_model.pkl'))
SERVICE_TOKEN = os.getenv('MODEL_SERVICE_TOKEN')

app = FastAPI(title='DGEP Abandonment Model Service', version='1.0.0')
model = None

class BookingFeatures(BaseModel):
    model_config = ConfigDict(extra='forbid')
    Booking_Value_NGN: float = Field(ge=0)
    lead_time: float = Field(alias='Lead time', ge=0)
    length_of_stay: float = Field(alias='Length of stay', gt=0)
    Room_Type: str = Field(min_length=1)
    Device_Type: str = Field(min_length=1)
    Channel: str = Field(min_length=1)

@app.on_event('startup')
def load_model():
    global model
    if not MODEL_PATH.exists():
        raise RuntimeError(f'Model file not found: {MODEL_PATH}')
    
    model = joblib.load(MODEL_PATH)

@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': model is not None}

@app.post('/predict')
def predict(payload: BookingFeatures, x_service_token: str | None = Header(default=None)):
    if not SERVICE_TOKEN or x_service_token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail='Unauthorized')
    if model is None:
        raise HTTPException(status_code=503, detail='Model is not loaded')
    
    row = {
        'Device_Type': payload.Device_Type,
        'Channel': payload.Channel,
        'Room_Type': payload.Room_Type,
        'Booking_Value_NGN': payload.Booking_Value_NGN,
        'Length of stay': payload.length_of_stay,
        'Lead time': payload.lead_time,
    }
    frame = pd.DataFrame([row])
    try:
        probabilities = model.predict_proba(frame)[0]
        classes = list(model.classes_)
        if 1 not in classes:
            raise RuntimeError('Model does not expose class 1 for abandoned bookings')
        abandonment_probability = float(probabilities[classes.index(1)])
        predicted_class = int(model.predict(frame)[0])
        risk, recommendations = generate_recommendation(abandonment_probability)
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Model prediction failed') from exc

    return {
        'success': True,
        'data': {
            'prediction': 'abandoned' if predicted_class == 1 else 'confirmed',
            'abandonment_probability': round(abandonment_probability, 6),
            'risk_level': risk,
            'recommended_actions': recommendations,
        },
    }
