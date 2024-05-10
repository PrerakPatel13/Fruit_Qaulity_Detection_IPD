import uvicorn 
from fastapi import FastAPI, File, UploadFile
import numpy as np
from keras.models import load_model 
from PIL import Image
import requests
from io import BytesIO
from colabcode import ColabCode
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove
from typing import List

cc = ColabCode(port = 8000, code = False)
app = FastAPI()
model = load_model('./fruit_quality.h5')

class_name = ['freshApples', 'freshBananas', 'freshOranges', 
              'rottenApples', 'rottenBananas', 'rottenOranges']

# CORS (Cross-Origin Resource Sharing) middleware to allow requests from React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (POST, GET, etc.)
    allow_headers=["*"], 
)


# def bgRemoval(content):
#     data = Image.open(BytesIO(content))
#     bg = Image.open(BytesIO(open('Server/bg1.jpg', 'rb').read()))
#     bg = bg.resize((data.width, data.height))

#     subject = remove(content, alpha_matting=True)
#     box = (0, 0, data.width, data.height)
#     bg.paste(subject, box, subject)

#     return subject


@app.get('/')
def index():
    return {'className': class_name}

def grade(result_class, per_res):
    thresholds = {
    'freshApples': {'A': 70, 'B': 40},  # Thresholds for grade A and B for fresh apples
    'freshBananas': {'A': 70, 'B': 40},  # Thresholds for grade A and B for fresh bananas
    'freshOranges': {'A': 70, 'B': 40},  # Thresholds for grade A and B for fresh oranges
    'rottenApples': {'C': 80, 'B': 40},  # Thresholds for grade B and C for rotten apples
    'rottenBananas': {'C': 80, 'B': 40},  # Thresholds for grade B and C for rotten bananas
    'rottenOranges': {'C': 80, 'B': 40}  # Thresholds for grade B and C for rotten oranges
    }
    grade = ''
    if result_class in thresholds:
        class_thresholds = thresholds[result_class]
        percentage = per_res[class_name.index(result_class)]
        for grade_label, threshold in class_thresholds.items():
            if percentage >= threshold:
                grade = grade_label
                break
        if grade == '':
            grade = 'C'
    else:
        grade = 'D'
    
    return grade

@app.post('/predict')
async def prediction(files: List[UploadFile] = File(...)): 
    predictions = [] # class
    arr_preds = [] # total percentage arr
    grading = [] # grading 
    for file in files:
        contents = await file.read()
        img = Image.open(BytesIO(contents))
        img = img.resize((224,224))
        img = img.convert('RGB')
        img_array = np.array(img)
        img_array = img_array.reshape((1,224,224,3))
        preds = model.predict(img_array)
        res = preds[0]
        per_res = np.round(res*100, decimals=2)
        c_n = class_name[np.argmax(preds)]
        predictions.append(c_n)
        arr_preds.append(int(per_res[class_name.index(c_n)]))
        g = grade(class_name[np.argmax(preds)], per_res)
        grading.append(g)

    final_res = max(set(predictions), key = predictions.count)
    final_grade = max(set(grading), key = predictions.count)
    match_out = [arr_preds[i] for i in range(len(arr_preds)) if final_res == predictions[i]]
    final_per = sum(match_out) / len(match_out) if match_out else 0

    return {'output': arr_preds, 'result': predictions, 'Grade':grading, 'final_result':final_res, 'final_grade':final_grade, 'final_per' : final_per}


@app.post('/predictUrl')
async def pred(image):
    response = requests.get(image)
    print(response)
    



cc.run_app(app = app)





