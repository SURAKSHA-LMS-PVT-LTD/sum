package lk.suraksha.lms;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/**
 * Custom Firebase Messaging Service to handle push notifications with images
 * This ensures notification images display correctly across all Android versions
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FCMService";
    private static final String CHANNEL_ID = "suraksha_lms_notifications";
    private static final String CHANNEL_NAME = "Suraksha LMS Notifications";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Check if message contains notification payload
        if (remoteMessage.getNotification() != null) {
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();
            String imageUrl = remoteMessage.getNotification().getImageUrl() != null
                    ? remoteMessage.getNotification().getImageUrl().toString()
                    : null;

            // Also check data payload for image (FCM can send in data.image or data.imageUrl)
            Map<String, String> data = remoteMessage.getData();
            if (imageUrl == null && data != null) {
                imageUrl = data.containsKey("image") ? data.get("image") : data.get("imageUrl");
            }

            Log.d(TAG, "Notification Title: " + title);
            Log.d(TAG, "Notification Body: " + body);
            Log.d(TAG, "Notification ImageUrl: " + imageUrl);

            sendNotification(title, body, imageUrl, data);
        }

        // Handle data-only messages (no notification payload)
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Message data payload: " + remoteMessage.getData());
            Map<String, String> data = remoteMessage.getData();

            // Extract notification info from data if notification payload missing
            if (remoteMessage.getNotification() == null) {
                String title = data.get("title");
                String body = data.get("body");
                String imageUrl = data.containsKey("image") ? data.get("image") : data.get("imageUrl");

                if (title != null && body != null) {
                    sendNotification(title, body, imageUrl, data);
                }
            }
        }
    }

    /**
     * Create and show a notification with optional image
     * Uses BigPictureStyle for images to ensure they display properly
     */
    private void sendNotification(String title, String messageBody, String imageUrl, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        // Add actionUrl to intent if present
        if (data != null && data.containsKey("actionUrl")) {
            intent.putExtra("actionUrl", data.get("actionUrl"));
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0 /* Request code */,
                intent,
                PendingIntent.FLAG_IMMUTABLE
        );

        // Default notification sound
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        // Create notification channel for Android O+
        createNotificationChannel();

        // Build notification
        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher) // Use app icon as small icon
                .setContentTitle(title)
                .setContentText(messageBody)
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(messageBody));

        // Download and attach image if URL provided
        if (imageUrl != null && !imageUrl.isEmpty()) {
            try {
                Log.d(TAG, "Downloading image: " + imageUrl);
                Bitmap bitmap = getBitmapFromUrl(imageUrl);

                if (bitmap != null) {
                    Log.d(TAG, "Image downloaded successfully");

                    // Use BigPictureStyle to display image in expanded notification
                    NotificationCompat.BigPictureStyle bigPictureStyle = new NotificationCompat.BigPictureStyle()
                            .bigPicture(bitmap)
                            .bigLargeIcon((Bitmap) null) // Hide large icon when expanded
                            .setBigContentTitle(title)
                            .setSummaryText(messageBody);

                    notificationBuilder.setStyle(bigPictureStyle);
                    notificationBuilder.setLargeIcon(bitmap); // Show as large icon when collapsed
                } else {
                    Log.w(TAG, "Failed to download image from URL: " + imageUrl);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error downloading notification image", e);
            }
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            int notificationId = (int) System.currentTimeMillis(); // Unique ID for each notification
            notificationManager.notify(notificationId, notificationBuilder.build());
            Log.d(TAG, "Notification displayed with ID: " + notificationId);
        }
    }

    /**
     * Download bitmap image from URL synchronously
     * Called from background thread by FCM
     */
    private Bitmap getBitmapFromUrl(String imageUrl) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(imageUrl);
            connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.setConnectTimeout(10000); // 10 second timeout
            connection.setReadTimeout(10000);
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                InputStream input = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                input.close();
                return bitmap;
            } else {
                Log.w(TAG, "Image download failed with response code: " + responseCode);
                return null;
            }
        } catch (IOException e) {
            Log.e(TAG, "IOException downloading image", e);
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    /**
     * Create notification channel for Android O and above
     *Required for notifications to work on Android 8.0+
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications from Suraksha LMS");
            channel.enableLights(true);
            channel.enableVibration(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "Refreshed FCM token: " + token);
        // Token refresh is handled by Capacitor Push Notifications plugin
        // No need to send to server here - the plugin handles it
    }
}
