# gabbar

import os
import requests
import json

from sklearn import svm
from sklearn.externals import joblib

has_legs = False

def download_changeset(changeset_id):
    url = 'https://s3.amazonaws.com/mapbox/real-changesets/production/{}.json'
    try:
        response = requests.get(url.format(changeset_id))
        if response.status_code == 200:
            changeset = json.loads(response.text)
            return changeset
    except Exception:
        return None

def changeset_to_data(changeset):
    """Convert changeset dictionary into an array with required features.

    Parameters
    ----------
    changeset: dict

    Returns
    -------
    data: tuple
        Tuple of data items
    """
    return [
        changeset['create'],
        changeset['modify'],
        changeset['delete']
    ]

def load_model():
    directory = os.path.dirname(os.path.realpath(__file__))
    filename = 'models/gabbar.pkl'
    model = os.path.join(directory, filename)
    return joblib.load(model)

def predict(model, data):
    """Returns model prediction for data.

    Parameters
    ----------
    model: object
        Trained machine learning classifier
    data: tuple
        Tuple of data items
    Returns
    -------
    prediction: int
        -1 for outlier, +1 for inlier
    """
    prediction = model.predict(data)
    return prediction[0]
