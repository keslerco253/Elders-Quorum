import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './android-widget';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// The Android home-screen widget is drawn by the app's JavaScript, in the background too.
if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
