import pandas as pd
import math
import time
import random


#now=0-indexed
def calc_fool(now):
  df=pd.read_csv('data.csv')
  x=df['x']
  y=df['y']
  n=len(x)

  if now>=n:
    print("error! now>=n")
    exit()

  dist=[]
  dist_sum=0
  for i in range(n):
    li=[]
    for j in range(n):
      li.append(math.sqrt((x[i]-x[j])**2+(y[i]-y[j])**2))
    dist.append(li)

  ans=[]
  ans.append(now)
  go=[False for i in range(n)]
  go[now]=True

  for  i in  range(n-1):
    val=1e10
    idx=-1
    for j in range(n):
      if not go[j]:
        if val>dist[now][j]:
          val=dist[now][j]
          idx=j
    dist_sum+=val
    now=idx
    ans.append(now)
    go[now]=True
  ans_df=pd.DataFrame(ans)
  ans_df.to_csv('ans_fool.csv')
  print(dist_sum)



def calc_opt(now):
  df=pd.read_csv('data.csv')
  x=df['x']
  y=df['y']
  n=len(x)
  ans_df=pd.read_csv('ans_fool.csv')
  path=ans_df['0'].tolist()

  dist=[]
  for i in range(n):
    li=[]
    for j in range(n):
      li.append(math.sqrt((x[i]-x[j])**2+(y[i]-y[j])**2))
    dist.append(li)

  t_start=time.time()

  # Calculate initial path length (not a closed loop)
  path_length = sum(dist[path[i]][path[i+1]] for i in range(n - 1))
  print(f"Initial path length: {path_length}")

  improved = True
  while improved:
    improved = False
    # Iterate through all pairs of non-adjacent edges to perform a 2-opt swap.
    # Edge 1: (path[i], path[i+1]), Edge 2: (path[j], path[j+1])
    # We ensure j > i + 1 so the edges are not adjacent.
    for i in range(n - 2):
      for j in range(i + 2, n - 1):
        p_i, p_i1 = path[i], path[i+1]
        p_j, p_j1 = path[j], path[j+1]

        # Cost of original edges
        current_edge_dist = dist[p_i][p_i1] + dist[p_j][p_j1]
        # Cost of new edges after reversing the segment path[i+1...j]
        new_edge_dist = dist[p_i][p_j] + dist[p_i1][p_j1]

        if new_edge_dist < current_edge_dist:
          # Perform the swap by reversing the segment
          path[i+1:j+1] = path[i+1:j+1][::-1]

          # Update total distance with the difference
          path_length += new_edge_dist - current_edge_dist
          improved = True
          break  # Exit inner loop and restart search
      if improved:
        break  # Exit outer loop and restart search

    if time.time() - t_start > 10: # Time limit
      print("Time limit exceeded.")
      break
      
  ans_df=pd.DataFrame(path)
  ans_df.to_csv('ans_opt.csv')
  print(f"Final optimized path distance: {path_length}")


def calc_dp(start_node):
    df = pd.read_csv('data.csv')
    x = df['x']
    y = df['y']
    n = len(x)

    if start_node >= n:
        print(f"Error: start_node {start_node} is out of bounds for {n} cities.")
        return

    if n == 0:
        print("No cities to route.")
        return
    
    dist = [[math.sqrt((x[i]-x[j])**2 + (y[i]-y[j])**2) for j in range(n)] for i in range(n)]

    dp = [[float('inf')] * n for _ in range(1 << n)]
    parent = [[-1] * n for _ in range(1 << n)]

    dp[1 << start_node][start_node] = 0

    for s in range(1, 1 << n):
        if not (s & (1 << start_node)):
            continue

        for v in range(n):
            if not (s & (1 << v)):
                continue

            prev_s = s ^ (1 << v)
            if prev_s == 0:
                continue

            min_val = float('inf')
            best_u = -1
            for u in range(n):
                if prev_s & (1 << u):
                    if dp[prev_s][u] != float('inf'):
                        val = dp[prev_s][u] + dist[u][v]
                        if val < min_val:
                            min_val = val
                            best_u = u
            
            if best_u != -1:
                dp[s][v] = min_val
                parent[s][v] = best_u

    final_mask = (1 << n) - 1
    min_tour_dist = float('inf')
    last_node = -1

    if n == 1:
        min_tour_dist = 0
        last_node = start_node
    else:
        for v in range(n):
            if dp[final_mask][v] < min_tour_dist:
                min_tour_dist = dp[final_mask][v]
                last_node = v

    path = []
    if last_node != -1:
        curr_mask = final_mask
        curr_node = last_node
        while curr_node != -1:
            path.append(curr_node)
            prev_node = parent[curr_mask][curr_node]
            curr_mask ^= (1 << curr_node)
            curr_node = prev_node
    
    path.reverse()
    
    if not path and n > 0:
        path.append(start_node)

    ans_df = pd.DataFrame(path)
    ans_df.to_csv('ans_dp.csv', index=False)
    print(f"DP path distance: {min_tour_dist}")




print("_loading_")
calc_fool(0)
calc_opt(0)
df_for_n = pd.read_csv('data.csv')
if len(df_for_n) <= 30:
    calc_dp(0)
else:
    print("Skipping DP calculation because N > 20.")
print("end!")