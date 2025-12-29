#include <pebble.h>

// --- 定数・グローバル変数 ---
static Window *s_main_window;
static TextLayer *s_location_layer;
static TextLayer *s_name_layer;
static TextLayer *s_stats_layer;

// メニュー用
static Window *s_area_menu_window;
static MenuLayer *s_area_menu_layer;
static Window *s_block_menu_window;
static MenuLayer *s_block_menu_layer;

static char s_location_buffer[32];
static char s_name_buffer[256];
static char s_stats_buffer[64];

// エリア定義
static char *s_areas[] = {"East 4-6", "East 7", "West", "South"};
static int s_selected_area_index = 0;

// ブロック定義 (UTF-8)
// 注: Pebbleのシステムフォントで日本語が表示できるかはモデルと言語設定による。
// 安全のため、ひらがな/カタカナはローマ字等にする手もあるが、まずはそのままトライ。
static char *s_blocks_e456[] = {"A", "I", "U", "E", "O", "Ka", "Ki", "Ku", "Ke", "Ko", "Sa", "Shi", "Su", "Se", "So", "Ta", "Chi", "Tsu", "Te", "To", "Na", "Ni", "Nu", "Ne", "No", "Ha", "Hi", "Fu", "He", "Ho", "Ma", "Mi", "Mu", "Me", "Mo", "Ya", "Yu", "Yo"}; 
static char *s_blocks_e456_kana[] = {"ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ", "ス", "セ", "ソ", "タ", "チ", "ツ", "テ", "ト", "ナ", "ニ", "ヌ", "ネ", "ノ", "ハ", "ヒ", "フ", "ヘ", "ホ", "マ", "ミ", "ム", "メ", "モ", "ヤ", "ユ", "ヨ"};

static char *s_blocks_e7[] = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"};

static char *s_blocks_w[] = {"a", "i", "u", "e", "o", "ka", "ki", "ku", "ke", "ko", "sa", "shi", "su", "se", "so", "ta", "chi", "tsu", "te", "to", "na", "ni", "nu", "ne", "no", "ha", "hi", "fu", "he", "ho", "ma", "mi", "mu", "me", "mo"}; 
static char *s_blocks_w_kana[] = {"あ", "い", "う", "え", "お", "か", "き", "く", "け", "こ", "さ", "し", "す", "せ", "そ", "た", "ち", "つ", "て", "と", "な", "に", "ぬ", "ね", "の", "は", "ひ", "ふ", "へ", "ほ", "ま", "み", "む", "め", "も"};

static char *s_blocks_s[] = {"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"};

// 選択中のブロックリストへのポインタと長さ
static char **s_current_blocks;
static char **s_current_blocks_display; // 表示用（カタカナ等）
static int s_current_blocks_count;
static char *s_current_area_prefix; // "東", "西" など

// --- 通信処理 ---

static void send_location_update(char *prefix, char *block) {
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  
  // 例: "東", "ア" -> "東ア01a" (簡易的に01aとする)
  static char buffer[16];
  snprintf(buffer, sizeof(buffer), "%s%s01a", prefix, block);
  
  dict_write_cstring(iter, MESSAGE_KEY_KEY_ACTION, "set_loc");
  dict_write_cstring(iter, MESSAGE_KEY_KEY_LOCATION, buffer);
  
  app_message_outbox_send();
}

static void inbox_received_callback(DictionaryIterator *iterator, void *context)
{
  Tuple *loc_tuple = dict_find(iterator, MESSAGE_KEY_KEY_LOCATION);
  if (loc_tuple) {
    snprintf(s_location_buffer, sizeof(s_location_buffer), "%s", loc_tuple->value->cstring);
    text_layer_set_text(s_location_layer, s_location_buffer);
  }

  Tuple *name_tuple = dict_find(iterator, MESSAGE_KEY_KEY_NAME);
  if (name_tuple) {
    snprintf(s_name_buffer, sizeof(s_name_buffer), "%s", name_tuple->value->cstring);
    text_layer_set_text(s_name_layer, s_name_buffer);
  }

  Tuple *stats_tuple = dict_find(iterator, MESSAGE_KEY_KEY_STATS);
  if (stats_tuple) {
    snprintf(s_stats_buffer, sizeof(s_stats_buffer), "%s", stats_tuple->value->cstring);
    text_layer_set_text(s_stats_layer, s_stats_buffer);
  }
}

// --- Block Menu ---

static uint16_t block_menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  return s_current_blocks_count;
}

static void block_menu_draw_row_callback(GContext* ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  // 表示用配列があればそれを、なければ送信用配列を表示
  char *text = s_current_blocks_display ? s_current_blocks_display[cell_index->row] : s_current_blocks[cell_index->row];
  menu_cell_basic_draw(ctx, cell_layer, text, NULL, NULL);
}

static void block_menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  // 選択されたブロックを送信
  send_location_update(s_current_area_prefix, s_current_blocks[cell_index->row]);
  
  // メニューを閉じてメイン画面に戻る
  window_stack_remove(s_block_menu_window, true);
  window_stack_remove(s_area_menu_window, true);
  
  text_layer_set_text(s_name_layer, "Updating Loc...");
}

static void block_menu_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_block_menu_layer = menu_layer_create(bounds);
  menu_layer_set_callbacks(s_block_menu_layer, NULL, (MenuLayerCallbacks){
    .get_num_rows = block_menu_get_num_rows_callback,
    .draw_row = block_menu_draw_row_callback,
    .select_click = block_menu_select_callback,
  });
  menu_layer_set_click_config_onto_window(s_block_menu_layer, window);
  layer_add_child(window_layer, menu_layer_get_layer(s_block_menu_layer));
}

static void block_menu_window_unload(Window *window) {
  menu_layer_destroy(s_block_menu_layer);
}

// --- Area Menu ---

static uint16_t area_menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  return 4;
}

static void area_menu_draw_row_callback(GContext* ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  menu_cell_basic_draw(ctx, cell_layer, s_areas[cell_index->row], NULL, NULL);
}

static void area_menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  s_selected_area_index = cell_index->row;
  
  // 選択エリアに応じてブロックリストをセットアップ
  switch (s_selected_area_index) {
    case 0: // East 4-6
      s_current_blocks = s_blocks_e456_kana; // Webアプリの設定に合わせてカタカナを送る
      s_current_blocks_display = s_blocks_e456_kana; 
      s_current_blocks_count = 38;
      s_current_area_prefix = "東";
      break;
    case 1: // East 7
      s_current_blocks = s_blocks_e7;
      s_current_blocks_display = NULL;
      s_current_blocks_count = 26;
      s_current_area_prefix = "東";
      break;
    case 2: // West
      s_current_blocks = s_blocks_w_kana;
      s_current_blocks_display = s_blocks_w_kana;
      s_current_blocks_count = 35;
      s_current_area_prefix = "西";
      break;
    case 3: // South
      s_current_blocks = s_blocks_s;
      s_current_blocks_display = NULL;
      s_current_blocks_count = 26;
      s_current_area_prefix = "南";
      break;
  }
  
  // ブロック選択画面へ遷移
  s_block_menu_window = window_create();
  window_set_window_handlers(s_block_menu_window, (WindowHandlers){
    .load = block_menu_window_load,
    .unload = block_menu_window_unload,
  });
  window_stack_push(s_block_menu_window, true);
}

static void area_menu_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_area_menu_layer = menu_layer_create(bounds);
  menu_layer_set_callbacks(s_area_menu_layer, NULL, (MenuLayerCallbacks){
    .get_num_rows = area_menu_get_num_rows_callback,
    .draw_row = area_menu_draw_row_callback,
    .select_click = area_menu_select_callback,
  });
  menu_layer_set_click_config_onto_window(s_area_menu_layer, window);
  layer_add_child(window_layer, menu_layer_get_layer(s_area_menu_layer));
}

static void area_menu_window_unload(Window *window) {
  menu_layer_destroy(s_area_menu_layer);
}

// --- Main Window ---

static void main_action_handler(ClickRecognizerRef recognizer, void *context) {
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  dict_write_cstring(iter, MESSAGE_KEY_KEY_ACTION, "bought");
  app_message_outbox_send();
  text_layer_set_text(s_name_layer, "Updating...");
}

static void main_down_handler(ClickRecognizerRef recognizer, void *context) {
  // エリア選択画面を開く
  s_area_menu_window = window_create();
  window_set_window_handlers(s_area_menu_window, (WindowHandlers){
    .load = area_menu_window_load,
    .unload = area_menu_window_unload,
  });
  window_stack_push(s_area_menu_window, true);
}

static void main_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, main_action_handler);
  window_single_click_subscribe(BUTTON_ID_UP, main_action_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, main_down_handler);
}

static void main_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_location_layer = text_layer_create(GRect(0, 5, bounds.size.w, 28));
  text_layer_set_background_color(s_location_layer, GColorBlack);
  text_layer_set_text_color(s_location_layer, GColorWhite);
  text_layer_set_font(s_location_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(s_location_layer, GTextAlignmentCenter);
  text_layer_set_text(s_location_layer, "ComiPath");
  layer_add_child(window_layer, text_layer_get_layer(s_location_layer));

  s_name_layer = text_layer_create(GRect(5, 40, bounds.size.w - 10, 80));
  text_layer_set_font(s_name_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(s_name_layer, GTextAlignmentCenter);
  text_layer_set_text(s_name_layer, "Waiting for data...");
  text_layer_set_overflow_mode(s_name_layer, GTextOverflowModeWordWrap);
  layer_add_child(window_layer, text_layer_get_layer(s_name_layer));

  s_stats_layer = text_layer_create(GRect(0, bounds.size.h - 25, bounds.size.w, 20));
  text_layer_set_font(s_stats_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_stats_layer, GTextAlignmentCenter);
  text_layer_set_text(s_stats_layer, "---");
  layer_add_child(window_layer, text_layer_get_layer(s_stats_layer));
}

static void main_window_unload(Window *window) {
  text_layer_destroy(s_location_layer);
  text_layer_destroy(s_name_layer);
  text_layer_destroy(s_stats_layer);
}

static void init(void) {
  s_main_window = window_create();
  window_set_click_config_provider(s_main_window, main_click_config_provider);
  window_set_window_handlers(s_main_window, (WindowHandlers){
    .load = main_window_load,
    .unload = main_window_unload,
  });
  window_stack_push(s_main_window, true);

  app_message_register_inbox_received(inbox_received_callback);
  app_message_open(1024, 256);
}

static void deinit(void) {
  window_destroy(s_main_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}