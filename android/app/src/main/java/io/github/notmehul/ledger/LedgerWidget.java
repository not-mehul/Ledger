package io.github.notmehul.ledger;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

/**
 * The home-screen widget: how many cities and countries are in the ledger,
 * the latest visit and its score. The app writes the lines (in its own
 * language) through LedgerWidgetPlugin whenever the ledger changes, so the
 * widget never refreshes on a timer. Tapping it opens Ledger.
 */
public class LedgerWidget extends AppWidgetProvider {

    static final String PREFS = "ledger_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    /** Redraws every Ledger widget on the home screen. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, LedgerWidget.class));
        if (ids.length > 0) manager.updateAppWidget(ids, views(context));
    }

    private static RemoteViews views(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.ledger_widget);
        views.setTextViewText(R.id.widget_headline, prefs.getString("headline", "Ledger"));
        views.setTextViewText(R.id.widget_detail, prefs.getString("detail", ""));
        String latest = prefs.getString("latest", "");
        String score = prefs.getString("score", "");
        views.setTextViewText(R.id.widget_latest, latest);
        views.setViewVisibility(R.id.widget_latest, latest.isEmpty() ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_score, score);
        views.setViewVisibility(R.id.widget_score, score.isEmpty() ? View.GONE : View.VISIBLE);

        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, tap);
        return views;
    }
}
