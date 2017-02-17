'''
OpenStreetMap diary post: http://www.openstreetmap.org/user/manoharuss/diary/40118
'''

import pandas as pd
from sklearn.externals import joblib

changesets = pd.read_csv('training/changesets.csv')

columns = ['create', 'modify', 'delete', 'harmful']
features = changesets[columns]
features = features.dropna()

model = joblib.load('gabbar/models/gabbar.pkl')

for (i, feature) in enumerate(features.values):
    prediction = model.predict([feature[:-1]])
    if prediction != True:
        print feature
        print changesets.iloc[i]
        break
