import sys
import random
import pandas as pd
import numpy as np

hour = sys.argv[1] #0-23
roadName = sys.argv[2]
speed = sys.argv[3]
weatherCode = sys.argv[4]
day = sys.argv[5] #0-364




def calculateProbability(day, hour, roadName, speed, weatherCode):
    # Do some black magic voodoo with these parameters to output a probability of crashing on this road
    # load json and create model
    df = pd.read_csv('library/Roads_and_speed_limits_new.csv')
    rd_sp = np.array(df['Roads'])
    sp_lmt = np.array(df['Speed Limit'])
    speed_preferred = 0

    if(roadName in rd_sp):
        index = np.where(roadName == rd_sp)[0][0]
        speed_preferred = sp_lmt[index]
    else:
        speed_preferred = speed
        
    ##################################################
    json_file = open('library/model.json', 'r')
    loaded_model_json = json_file.read()
    json_file.close()
    
    loaded_model = model_from_json(loaded_model_json)
    
    # load weights into new model
    loaded_model.load_weights("library/model.h5")
    print("Loaded model from disk")
    ##################################################
    
    weatherCode = (weatherCode-6)/12
    hour = (hour - (23/2))/24
    day = (day - (365/2))/365
    speed_preferred = (speed_preferred-55)/70
    
    ##################################################
    
    x = np.array([[weatherCode,hour,day,speed_preferred]])
    
    per = loaded_model.predict(x, batch_size=None, verbose=0, steps=None)[0][0]
    
    return per




# Print probability to send it to web server
print("%s,%s" % (roadName, calculateProbability(day, hour, roadName, speed, weatherCode)))
sys.stdout.flush()