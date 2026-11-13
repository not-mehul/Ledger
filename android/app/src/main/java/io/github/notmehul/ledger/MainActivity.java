package io.github.notmehul.ledger;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FolderSyncPlugin.class);
        registerPlugin(LedgerWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
