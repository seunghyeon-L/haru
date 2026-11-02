package com.seunghyeon.haru;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/** 홈 화면 위젯: 오늘 루틴을 보여주고 눌러서 체크한다. */
public class HaruWidget extends AppWidgetProvider {
    static final String ACTION_TOGGLE = "com.seunghyeon.haru.TOGGLE";
    static final String ACTION_REFRESH = "com.seunghyeon.haru.REFRESH";
    static final String EXTRA_ID = "id";
    static final String EXTRA_DATE = "date";
    private static final String[] WEEK = {"일", "월", "화", "수", "목", "금", "토"};

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        RemoteViews views = build(ctx);
        for (int id : ids) mgr.updateAppWidget(id, views);
        scheduleMidnight(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String action = intent.getAction();
        if (ACTION_TOGGLE.equals(action)) {
            String date = intent.getStringExtra(EXTRA_DATE);
            HaruStore.toggle(ctx, intent.getStringExtra(EXTRA_ID), date == null ? LocalDate.now() : LocalDate.parse(date));
            updateAll(ctx);
        } else if (ACTION_REFRESH.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            updateAll(ctx);
        }
    }

    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, HaruWidget.class));
        if (ids.length == 0) return;
        RemoteViews views = build(ctx);
        for (int id : ids) mgr.updateAppWidget(id, views);
        scheduleMidnight(ctx);
    }

    private static RemoteViews build(Context ctx) {
        String pkg = ctx.getPackageName();
        LocalDate today = LocalDate.now();
        JSONObject s = HaruStore.state(ctx);
        List<HaruStore.Item> items = HaruStore.items(s, today);
        int done = 0;
        for (HaruStore.Item it : items) if (it.done) done++;

        RemoteViews rv = new RemoteViews(pkg, R.layout.widget);
        rv.setTextViewText(R.id.date, today.getMonthValue() + "월 " + today.getDayOfMonth() + "일 " + WEEK[HaruStore.jsDow(today)] + "요일");
        rv.setTextViewText(R.id.progress, items.isEmpty() ? "" : done + " / " + items.size());
        rv.setTextViewText(R.id.empty, HaruStore.hasHabits(s) ? "오늘은 예정된 루틴이 없어요" : "앱에서 루틴을 추가해 주세요");

        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        rv.setOnClickPendingIntent(R.id.header,
                PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        rv.setOnClickPendingIntent(R.id.empty,
                PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        RemoteViews.RemoteCollectionItems.Builder list = new RemoteViews.RemoteCollectionItems.Builder()
                .setHasStableIds(true)
                .setViewTypeCount(1);
        for (HaruStore.Item it : items) {
            RemoteViews row = new RemoteViews(pkg, R.layout.widget_item);
            row.setImageViewResource(R.id.check, it.done ? R.drawable.check_on : R.drawable.check_off);
            CharSequence title = it.title;
            if (it.done) {
                SpannableString span = new SpannableString(it.title);
                span.setSpan(new StrikethroughSpan(), 0, span.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                title = span;
            }
            row.setTextViewText(R.id.title, title);
            row.setFloat(R.id.title, "setAlpha", it.done ? 0.45f : 1f);
            String meta = HaruStore.SLOT_LABELS[it.slot] + (it.streak > 0 ? "  ·  🔥 " + it.streak + "일" : "");
            row.setTextViewText(R.id.meta, meta);
            row.setOnClickFillInIntent(R.id.row, new Intent()
                    .putExtra(EXTRA_ID, it.id)
                    .putExtra(EXTRA_DATE, today.toString()));
            list.addItem(it.id.hashCode(), row);
        }
        rv.setRemoteAdapter(R.id.list, list.build());
        rv.setEmptyView(R.id.list, R.id.empty);

        Intent toggle = new Intent(ctx, HaruWidget.class).setAction(ACTION_TOGGLE);
        rv.setPendingIntentTemplate(R.id.list,
                PendingIntent.getBroadcast(ctx, 1, toggle, PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return rv;
    }

    /** 자정이 지나면 새 날짜의 루틴으로 바꾼다. */
    private static void scheduleMidnight(Context ctx) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return;
        long at = LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli() + 5_000;
        Intent refresh = new Intent(ctx, HaruWidget.class).setAction(ACTION_REFRESH);
        am.set(AlarmManager.RTC, at,
                PendingIntent.getBroadcast(ctx, 2, refresh, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    }
}
