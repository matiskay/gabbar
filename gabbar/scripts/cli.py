import warnings
warnings.filterwarnings("ignore", category=UserWarning)

import sys
import os
import datetime
import json

import gabbar


def get_prediction(changeset):
    features = gabbar.get_features(changeset)
    filtered = gabbar.filter_features(features)
    normalized = gabbar.normalize_features(filtered)
    prediction = gabbar.get_prediction(normalized)
    return prediction


def converter(o):
    if isinstance(o, datetime.datetime):
        return o.__str__()


if __name__ == '__main__':
    changeset = sys.argv[1]
    prediction = get_prediction(changeset)
    if prediction == 1:
        prediction = 'good'
    else:
        prediction = 'harmful'

    directory = os.path.dirname(os.path.realpath(__file__))
    version_filepath = os.path.join(directory, '../../VERSION')
    with open(version_filepath) as f:
        version = f.read().strip()

    timestamp = datetime.datetime.now()
    results = {
        'prediction': prediction,
        'version': version,
        'timestamp': timestamp
    }
    print(json.dumps(results, sort_keys=True, default=converter))
