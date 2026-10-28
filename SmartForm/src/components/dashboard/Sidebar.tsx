import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const palette = {
  text: '#172033',
  subtle: '#6b7280',
  inactive: 'rgba(107, 114, 128, 0.8)',
  primary: '#7657F7',
  white: '#FFFFFF',
};

const NavItem = ({
  icon,
  name,
  active,
  onPress,
}: {
  icon: any;
  name: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={[styles.navItem, active && styles.navItemActive]} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.navIcon, active && styles.navIconActive]}>
      <Feather name={icon} size={18} color={active ? palette.white : palette.primary} />
    </View>
    <Text style={[styles.navText, active && styles.navTextActive]}>{name}</Text>
  </TouchableOpacity>
);

export const Sidebar = ({ navigation, onToggle }: { navigation: any; onToggle: () => void }) => {
  const { user, logout } = useAuth();
  const [activeRoute, setActiveRoute] = React.useState('Dashboard');
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleNavigation = (routeName: string) => {
    setActiveRoute(routeName);
    navigation.navigate(routeName);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'AuthStack' }],
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={styles.sidebar}>
      <View>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Feather name="grid" size={18} color={palette.primary} />
            </View>
            <View>
              <Text style={styles.headerText}>SmartForm</Text>
              <Text style={styles.headerSubtext}>Premium workspace</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onToggle} activeOpacity={0.8}>
            <Feather name="x" size={18} color={palette.subtle} />
          </TouchableOpacity>
        </View>

        <View style={styles.nav}>
          <NavItem icon="home" name="Dashboard" active={activeRoute === 'Dashboard'} onPress={() => handleNavigation('Dashboard')} />
          <NavItem icon="file-text" name="Forms" active={activeRoute === 'FormsList'} onPress={() => handleNavigation('FormsList')} />
          <NavItem icon="bar-chart-2" name="Analytics" active={activeRoute === 'Analytics'} onPress={() => handleNavigation('Analytics')} />
          <NavItem icon="zap" name="AI Studio" active={activeRoute === 'AiStudio'} onPress={() => handleNavigation('AiStudio')} />
          <NavItem icon="activity" name="Response Analyzer" active={activeRoute === 'ResponseAnalyzer'} onPress={() => handleNavigation('ResponseAnalyzer')} />
          <NavItem icon="settings" name="Settings" active={activeRoute === 'Profile'} onPress={() => handleNavigation('Profile')} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userCopy}>
            <Text style={styles.userName}>{user?.name ?? 'Guest User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Feather name="log-out" size={18} color={palette.primary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 282,
    borderRadius: 28,
    padding: 18,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.84)',
    shadowColor: 'rgba(49, 34, 111, 0.16)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(118, 87, 247, 0.08)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 87, 247, 0.08)',
  },
  headerText: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtext: {
    color: palette.subtle,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  nav: {
    marginTop: 18,
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 18,
  },
  navItemActive: {
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    marginRight: 12,
  },
  navIconActive: {
    backgroundColor: palette.primary,
  },
  navText: {
    color: palette.inactive,
    fontSize: 15,
    fontWeight: '700',
  },
  navTextActive: {
    color: palette.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  profileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(118, 87, 247, 0.12)',
  },
  avatarText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  userCopy: {
    flex: 1,
  },
  userName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  userEmail: {
    color: palette.subtle,
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    width: 42,
    height: 42,
    marginLeft: 10,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
});
