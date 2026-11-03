package com.seunghyeon.haru;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * 앱(WebView)과 위젯이 함께 쓰는 저장소.
 * 웹앱과 같은 JSON 형식을 그대로 SharedPreferences 에 보관한다.
 */
final class HaruStore {
    private static final String PREFS = "haru";
    private static final String KEY = "state";
    static final String[] SLOTS = {"morning", "afternoon", "evening", "anytime"};
    static final String[] SLOT_LABELS = {"아침", "오후", "저녁", "언제든"};
    /** app.js PALETTE 와 같은 순서. 색이 없는 예전 루틴은 순서대로 받는다. */
    static final String[] PALETTE = {"#4c7df0", "#7b6cf0", "#b062e0", "#e2659b", "#ec5b57", "#f08a3e", "#dfa42a", "#3aae73", "#1fa79f", "#6b7a90"};

    private HaruStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized String read(Context c) {
        return prefs(c).getString(KEY, null);
    }

    static synchronized void write(Context c, String json) {
        prefs(c).edit().putString(KEY, json).commit();
    }

    static JSONObject state(Context c) {
        String raw = read(c);
        if (raw != null) {
            try {
                JSONObject s = new JSONObject(raw);
                if (s.optInt("version") == 1) return s;
            } catch (JSONException ignored) {
                // 손상된 값이면 빈 상태로 본다.
            }
        }
        return new JSONObject();
    }

    /** 웹앱의 요일 번호: 0=일 ... 6=토 */
    static int jsDow(LocalDate d) {
        return d.getDayOfWeek().getValue() % 7;
    }

    static boolean hasDay(JSONObject h, int dow) {
        JSONArray days = h.optJSONArray("days");
        if (days == null) return false;
        for (int i = 0; i < days.length(); i++) if (days.optInt(i, -1) == dow) return true;
        return false;
    }

    static boolean isScheduled(JSONObject h, LocalDate d) {
        return d.toString().compareTo(h.optString("createdAt", "")) >= 0 && hasDay(h, jsDow(d));
    }

    static boolean isDone(JSONObject s, String id, LocalDate d) {
        JSONObject log = s.optJSONObject("log");
        JSONArray ids = log == null ? null : log.optJSONArray(d.toString());
        if (ids == null) return false;
        for (int i = 0; i < ids.length(); i++) if (id.equals(ids.optString(i))) return true;
        return false;
    }

    /** 오늘을 아직 안 했으면 어제부터 센다 (웹앱과 같은 규칙). */
    static int streak(JSONObject s, JSONObject h, LocalDate today) {
        String id = h.optString("id");
        String created = h.optString("createdAt", today.toString());
        LocalDate d = isDone(s, id, today) ? today : today.minusDays(1);
        int n = 0;
        while (d.toString().compareTo(created) >= 0) {
            if (hasDay(h, jsDow(d))) {
                if (isDone(s, id, d)) n++;
                else break;
            }
            d = d.minusDays(1);
        }
        return n;
    }

    static final class Item {
        String id;
        String title;
        int slot;
        int order;
        boolean done;
        int streak;
        int color;
        /** 이모지 아이콘, 없으면 제목 첫 글자 */
        String icon;
    }

    static int color(JSONObject h, int index) {
        String c = h.optString("color", "");
        if (!c.matches("#[0-9a-fA-F]{6}")) c = PALETTE[index % PALETTE.length];
        return Color.parseColor(c);
    }

    static String icon(JSONObject h) {
        String icon = h.optString("icon", "");
        if (!icon.isEmpty()) return icon;
        String title = h.optString("title", "").trim();
        if (title.isEmpty()) return "·";
        return title.substring(0, title.offsetByCodePoints(0, 1)).toUpperCase(Locale.ROOT);
    }

    /** 그날 예정된 루틴을 시간대 → 순서대로 */
    static List<Item> items(JSONObject s, LocalDate d) {
        List<Item> out = new ArrayList<>();
        JSONArray habits = s.optJSONArray("habits");
        if (habits == null) return out;
        for (int i = 0; i < habits.length(); i++) {
            JSONObject h = habits.optJSONObject(i);
            if (h == null || !isScheduled(h, d)) continue;
            Item it = new Item();
            it.id = h.optString("id");
            it.title = h.optString("title");
            it.slot = slotIndex(h.optString("slot"));
            it.order = h.optInt("order");
            it.done = isDone(s, it.id, d);
            it.streak = streak(s, h, d);
            it.color = color(h, i);
            it.icon = icon(h);
            out.add(it);
        }
        out.sort(Comparator.<Item>comparingInt(x -> x.slot).thenComparingInt(x -> x.order));
        return out;
    }

    static boolean hasHabits(JSONObject s) {
        JSONArray habits = s.optJSONArray("habits");
        return habits != null && habits.length() > 0;
    }

    static int slotIndex(String slot) {
        for (int i = 0; i < SLOTS.length; i++) if (SLOTS[i].equals(slot)) return i;
        return SLOTS.length - 1;
    }

    static synchronized void toggle(Context c, String id, LocalDate d) {
        JSONObject s = state(c);
        if (s.optInt("version") != 1 || id == null) return;
        try {
            JSONObject log = s.optJSONObject("log");
            if (log == null) {
                log = new JSONObject();
                s.put("log", log);
            }
            String key = d.toString();
            JSONArray ids = log.optJSONArray(key);
            JSONArray next = new JSONArray();
            boolean found = false;
            if (ids != null) {
                for (int i = 0; i < ids.length(); i++) {
                    if (id.equals(ids.optString(i))) found = true;
                    else next.put(ids.optString(i));
                }
            }
            if (!found) next.put(id);
            if (next.length() > 0) log.put(key, next);
            else log.remove(key);
            write(c, s.toString());
        } catch (JSONException ignored) {
            // 쓰기 실패 시 상태를 그대로 둔다.
        }
    }
}
