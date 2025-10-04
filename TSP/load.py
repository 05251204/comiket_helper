import random
import numpy as np
import pandas as pd

print("loading___")
n=250
x=[random.randint(0,1000) for i in range(n)]
y=[random.randint(0,1000) for i in range(n)]

df=pd.DataFrame()
df['x']=x
df['y']=y

try:
  df.to_csv('data.csv')
except Exception as e:
  print(f"error! {e}")
  exit()

print("end")