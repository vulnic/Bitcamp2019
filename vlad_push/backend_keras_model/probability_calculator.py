import sys
import random

time = sys.argv[1]
roadName = sys.argv[2]
speed = sys.argv[3]
weatherCode = sys.argv[4]



def calculateProbability(day, hour, roadName, speed, weatherCode):
    # Do some black magic voodoo with these parameters to output a probability of crashing on this road
    # load json and create model
    json_file = open('model.json', 'r')
    loaded_model_json = json_file.read()
    json_file.close()
    
    loaded_model = model_from_json(loaded_model_json)
    
    # load weights into new model
    loaded_model.load_weights("model.h5")
    print("Loaded model from disk")
    
    weatherCode = (weatherCode-6)/12
    hour = (hour - (23/2))/24
    day = (day - (365/2))/365
    speed = (speed-55)/70
    
    x = [weatherCode,hour,day,speed]
    
    predict(x, batch_size=None, verbose=0, steps=None, callbacks=None)
    
    return random.uniform(0, 1)





# Print probability to send it to web server
print("%s,%s" % (roadName, calculateProbability(time, roadName, speed, weatherCode)))
sys.stdout.flush()