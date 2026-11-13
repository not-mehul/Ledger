package io.github.notmehul.ledger;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the widget's lines from the app (src/platform/widget.ts). */
@CapacitorPlugin(name = "LedgerWidget")
public class LedgerWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(LedgerWidget.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("headline", call.getString("headline", "Ledger"))
            .putString("detail", call.getString("detail", ""))
            .putString("latest", call.getString("latest", ""))
            .putString("score", call.getString("score", ""))
            .apply();
        LedgerWidget.refresh(context);
        call.resolve();
    }
}
