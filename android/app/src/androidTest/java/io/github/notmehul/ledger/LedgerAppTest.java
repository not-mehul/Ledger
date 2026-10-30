package io.github.notmehul.ledger;

import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.getText;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webKeys;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.espresso.web.webdriver.Locator;
import java.io.File;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Drives the real app (WebView + native plugins) on a device or emulator:
 * saves an entry, then recreates the activity and checks the entry was
 * persisted by the Filesystem-backed store.
 */
@RunWith(AndroidJUnit4.class)
public class LedgerAppTest {

    private static final long TIMEOUT_MS = 30_000;

    @Before
    public void clearData() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        deleteRecursively(new File(context.getFilesDir(), "ledger.json"));
        deleteRecursively(new File(context.getFilesDir(), "photos"));
    }

    @Test
    public void savesAnEntryAndKeepsItAcrossRestarts() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForText("fileStatus", "0");

            onWebView().withElement(findElement(Locator.ID, "inputCity")).perform(webKeys("Lisbon"));
            onWebView().withElement(findElement(Locator.ID, "inputState")).perform(webKeys("Portugal"));
            onWebView().withElement(findElement(Locator.ID, "btnSave")).perform(webClick());
            waitForText("entryBadge", "1");

            scenario.recreate();

            waitForText("entryBadge", "1");
            onWebView().withElement(findElement(Locator.ID, "tabLogbook")).perform(webClick());
            onWebView()
                .withElement(findElement(Locator.CSS_SELECTOR, ".entry-city-name"))
                .check(webMatches(getText(), containsString("Lisbon")));
        }
    }

    @Test
    public void opensEveryTab() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForText("fileStatus", "0");
            for (String tab : new String[] { "tabMap", "tabSettings", "tabLogbook", "tabNew" }) {
                onWebView().withElement(findElement(Locator.ID, tab)).perform(webClick());
            }
            onWebView()
                .withElement(findElement(Locator.ID, "btnSave"))
                .check(webMatches(getText(), anyOf(equalTo("SAVE ENTRY"), equalTo("Save Entry"))));
        }
    }

    /** Polls until the element exists and its text contains `expected`. */
    private static void waitForText(String id, String expected) {
        long deadline = System.currentTimeMillis() + TIMEOUT_MS;
        AssertionError last = null;
        while (System.currentTimeMillis() < deadline) {
            try {
                onWebView().withElement(findElement(Locator.ID, id)).check(webMatches(getText(), containsString(expected)));
                return;
            } catch (RuntimeException | AssertionError e) {
                last = e instanceof AssertionError ? (AssertionError) e : new AssertionError(e);
                try {
                    Thread.sleep(250);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new AssertionError(interrupted);
                }
            }
        }
        throw last != null ? last : new AssertionError("Timed out waiting for #" + id);
    }

    private static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
