package io.github.notmehul.ledger;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Shared text past this is cut: an address or a map link is far shorter. */
    private static final int MAX_SHARED = 2000;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FolderSyncPlugin.class);
        registerPlugin(LedgerWidgetPlugin.class);
        // Before the bridge starts, so a share that launched Ledger reaches
        // the page as its launch link.
        setIntent(fromShare(getIntent()));
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(fromShare(intent));
    }

    /**
     * Text shared to Ledger (a place from Maps, an address from a browser)
     * becomes ledger://share?subject=…&text=…, which src/platform/incoming.ts
     * reads like any other link. Every other intent passes through unchanged.
     */
    static Intent fromShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return intent;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text == null && subject == null) return intent;
        Uri.Builder link = new Uri.Builder().scheme("ledger").authority("share");
        if (subject != null) link.appendQueryParameter("subject", cut(subject));
        if (text != null) link.appendQueryParameter("text", cut(text.toString()));
        return new Intent(Intent.ACTION_VIEW, link.build());
    }

    private static String cut(String s) {
        return s.length() > MAX_SHARED ? s.substring(0, MAX_SHARED) : s;
    }
}
