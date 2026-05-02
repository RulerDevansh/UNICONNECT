import { Text, View } from 'react-native';
import { Bell, History, LogOut, ShieldCheck, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { AppButton, Card, Screen, Title } from '../components/ui';
import { colors, spacing } from '../theme';

const MoreScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const isAdmin = user?.role === 'admin';

  return (
    <Screen>
      <Title subtitle={user?.email || 'Account tools'}>More</Title>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{user?.name || 'UniConnect'}</Text>
          <AppButton title="Profile" icon={User} variant="outline" onPress={() => navigation.navigate('Profile')} />
          <AppButton title={`Notifications${unreadCount ? ` (${unreadCount})` : ''}`} icon={Bell} variant="outline" onPress={() => navigation.navigate('Notifications')} />
          <AppButton title="History" icon={History} variant="outline" onPress={() => navigation.navigate('History')} />
          {isAdmin && <AppButton title="Admin Workspace" icon={ShieldCheck} variant="success" onPress={() => navigation.navigate('Admin')} />}
          <AppButton title="Logout" icon={LogOut} variant="danger" onPress={logout} />
        </View>
      </Card>
    </Screen>
  );
};

export default MoreScreen;
