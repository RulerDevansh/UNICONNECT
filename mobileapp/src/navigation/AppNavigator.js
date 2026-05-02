import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Home, LogIn, Menu, MessageCircle, Store, UsersRound } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotifications } from '../context/NotificationContext';
import HomeScreen from '../screens/HomeScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import CreateRentalScreen from '../screens/CreateRentalScreen';
import EditListingScreen from '../screens/EditListingScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
import SharingScreen from '../screens/SharingScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AdminScreen from '../screens/AdminScreen';
import MoreScreen from '../screens/MoreScreen';
import AIAssistantOverlay from '../components/AIAssistantOverlay';
import { AppButton, Card, Screen, Title } from '../components/ui';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ProtectedGate = ({ children, navigation }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Splash />;
  if (!isAuthenticated) {
    navigation.replace('Login');
    return <Splash />;
  }
  return children;
};

const withProtection = (Component) => (props) => (
  <ProtectedGate navigation={props.navigation}>
    <Component {...props} />
  </ProtectedGate>
);

const MainTabs = () => {
  const { isAuthenticated } = useAuth();
  const { hasNewMessage } = useSocket();
  const { unreadCount } = useNotifications();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#07111f',
            borderTopColor: 'rgba(51,65,85,0.75)',
            height: 74,
            paddingTop: 8,
            paddingBottom: 10,
            elevation: 14,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '800', marginTop: 2 },
          tabBarItemStyle: { paddingVertical: 2 },
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: (props) => <TabIcon icon={Home} {...props} /> }} />
        <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ tabBarLabel: 'Market', tabBarIcon: (props) => <TabIcon icon={Store} {...props} /> }} />
        {isAuthenticated ? (
          <>
            <Tab.Screen name="Sharing" component={SharingScreen} options={{ tabBarIcon: (props) => <TabIcon icon={UsersRound} {...props} /> }} />
            <Tab.Screen
              name="MyListings"
              component={MyListingsScreen}
              options={{ tabBarLabel: 'Listings', tabBarIcon: (props) => <TabIcon icon={ClipboardList} {...props} /> }}
            />
            <Tab.Screen
              name="Chat"
              component={ChatScreen}
              options={{ tabBarBadge: hasNewMessage ? 'new' : undefined, tabBarIcon: (props) => <TabIcon icon={MessageCircle} {...props} /> }}
            />
            <Tab.Screen
              name="More"
              component={MoreScreen}
              options={{ tabBarBadge: unreadCount || undefined, tabBarIcon: (props) => <TabIcon icon={Menu} {...props} /> }}
            />
          </>
        ) : (
          <Tab.Screen name="Guest" component={GuestScreen} options={{ tabBarLabel: 'Login', tabBarIcon: (props) => <TabIcon icon={LogIn} {...props} /> }} />
        )}
      </Tab.Navigator>
      <AIAssistantOverlay />
    </View>
  );
};

const AppNavigator = () => {
  const { loading } = useAuth();
  if (loading) return <Splash />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '900' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verify Email' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
        <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Listing' }} />
        <Stack.Screen name="CreateListing" component={withProtection(CreateListingScreen)} options={{ title: 'Create Listing' }} />
        <Stack.Screen name="CreateRental" component={withProtection(CreateRentalScreen)} options={{ title: 'Create Rental' }} />
        <Stack.Screen name="EditListing" component={withProtection(EditListingScreen)} options={{ title: 'Edit Listing' }} />
        <Stack.Screen name="Rentals" component={withProtection(MyListingsScreen)} options={{ title: 'My Listings' }} />
        <Stack.Screen name="Profile" component={withProtection(ProfileScreen)} />
        <Stack.Screen name="Notifications" component={withProtection(NotificationsScreen)} />
        <Stack.Screen name="History" component={withProtection(HistoryScreen)} />
        <Stack.Screen name="Admin" component={withProtection(AdminScreen)} options={{ title: 'Admin' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const Splash = () => (
  <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={colors.primary} size="large" />
    <Text style={{ color: colors.muted, marginTop: 10 }}>Loading UniConnect...</Text>
  </View>
);

const GuestScreen = ({ navigation }) => {
  const root = navigation.getParent?.();
  return (
    <Screen>
      <Title subtitle="Sign in to chat, share, list items, and manage requests.">Join UniConnect</Title>
      <Card>
        <View style={{ gap: 10 }}>
          <AppButton title="Login" onPress={() => root?.navigate('Login')} />
          <AppButton title="Register" variant="outline" onPress={() => root?.navigate('Register')} />
        </View>
      </Card>
    </Screen>
  );
};

const TabIcon = ({ icon: Icon, color, focused }) => (
  <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
    <Icon size={20} color={focused ? colors.text : color} strokeWidth={focused ? 2.8 : 2.3} />
  </View>
);

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.mutedBorder,
    primary: colors.primary,
  },
};

const styles = StyleSheet.create({
  tabIcon: {
    width: 32,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: 'rgba(37,99,235,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.25)',
  },
});

export default AppNavigator;
