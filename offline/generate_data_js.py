import csv
import json

def generate_data_js_content(csv_file_path):
    """
    CSVファイルからspace, user, tweetを抽出し、data.jsのwantToBuy形式のJSON文字列を生成する。
    """
    output_data = []

    with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            space = row.get('space')
            user = row.get('user') # CSVのヘッダーが 'uset' なので注意
            tweet = row.get('tweet')
  
            if space and user and tweet:
                output_data.append({
                    "space": space,
                    "user": user,
                    "tweet": tweet
                })
  
    json_output = json.dumps(output_data, ensure_ascii=False, indent=4)
    print(f"wantToBuy : {json_output}")
    print("\n// このwantToBuyDataをdata.jsのcomiketData.wantToBuyに貼り付けてください。")
    print("// 例: comiketData.wantToBuy = wantToBuyData;")
csv_file = 'data.csv' 
generate_data_js_content(csv_file)