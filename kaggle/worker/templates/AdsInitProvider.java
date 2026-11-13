package __PACKAGE__;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;

/** Initializes the ads runtime at process start (before any Activity). */
public class AdsInitProvider extends ContentProvider {
    @Override public boolean onCreate() {
        if (getContext() != null) AdsController.init((android.app.Application) getContext().getApplicationContext());
        return true;
    }
    @Override public Cursor query(Uri uri, String[] p, String s, String[] a, String o) { return null; }
    @Override public String getType(Uri uri) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String s, String[] a) { return 0; }
}
