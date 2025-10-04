import matplotlib
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.collections import LineCollection 
import pandas as pd
import numpy as np

def visualize(path):
  df=pd.read_csv("data.csv")
  x=df['x']
  y=df['y']
  n=len(x)
  try:
    ans_df=pd.read_csv(path)
  except FileNotFoundError:
    print(f"Error: The file '{path}' was not found.")
    print("Please make sure 'logic.py' has been run and the correct file path is provided.")
    return
    
  ans=ans_df['0']

  fig=plt.figure()
  ax=fig.add_subplot(111)
  ax.scatter(x,y)
  # Mark start and end points
  ax.scatter(x[ans[0]],y[ans[0]],c='r', zorder=5, label='Start')
  ax.scatter(x[ans[n-1]],y[ans[n-1]],c='g', zorder=5, label='End')
  
  # Draw the path by connecting points directly
  for i in range(n-1):
    x1, y1 = x[ans[i]], y[ans[i]]
    x2, y2 = x[ans[i+1]], y[ans[i+1]]
    ax.plot([x1, x2], [y1, y2], color='blue', linestyle='-', marker='o', markersize=3)

  ax.legend()
  plt.savefig('fool.png')



visualize("ans_opt.csv")

