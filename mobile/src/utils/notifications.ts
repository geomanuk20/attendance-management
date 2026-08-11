import Constants, { ExecutionEnvironment } from 'expo-constants';

let Notifications: any = null;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || (Constants as any).appOwnership === 'expo';

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
  } catch (e) {
    console.warn('Expo Notifications safely caught:', e);
  }
}

export const requestNotificationPermission = async () => {
  if (isExpoGo || !Notifications) return true;
  try {
    if (typeof Notifications.getPermissionsAsync === 'function') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    }
  } catch (error) {
    console.warn('Error requesting notification permission:', error);
  }
  return true;
};

export const triggerTestNotification = async (title: string, body: string) => {
  if (isExpoGo || !Notifications) return;
  try {
    if (typeof Notifications.scheduleNotificationAsync === 'function') {
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    }
  } catch (error) {
    console.warn('Error sending local test notification:', error);
  }
};

export default Notifications;
