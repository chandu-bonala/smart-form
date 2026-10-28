import React, { useCallback, useState } from 'react';
import { NavigationContainer, LinkingOptions, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LandingScreen } from '../screens/auth/LandingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminFormsScreen } from '../screens/admin/AdminFormsScreen';
import { AdminUserDetailScreen } from '../screens/admin/AdminUserDetailScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { DashboardScreen } from '../screens/app/DashboardScreen';
import { FormsListScreen } from '../screens/app/FormsListScreen';
import { FormCreateScreen } from '../screens/app/FormCreateScreen';
import { FormDetailScreen } from '../screens/app/FormDetailScreen';
import { FormPreviewScreen } from '../screens/app/FormPreviewScreen';
import { FormConditionsScreen } from '../screens/app/FormConditionsScreen';
import { BranchDetailScreen } from '../screens/app/BranchDetailScreen';
import { FormResponsesScreen } from '../screens/app/FormResponsesScreen';
import { FormVersionDetailScreen } from '../screens/app/FormVersionDetailScreen';
import { FormShareScreen } from '../screens/app/FormShareScreen';
import { AnalyticsScreen } from '../screens/app/AnalyticsScreen';
import { AiStudioScreen } from '../screens/app/AiStudioScreen';
import { ResponseAnalyzerScreen } from '../screens/app/ResponseAnalyzerScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { PublicFormScreen } from '../screens/app/PublicFormScreen';
import { FloatingAiChat } from '../components/FloatingAiChat';
import {
  RootStackParamList,
  AuthStackParamList,
  AppStackParamList,
  AdminStackParamList,
} from './NavigationTypes';

const AdminAnalyticsScreen = AnalyticsScreen;
const AdminFormDetailScreen = FormDetailScreen as React.ComponentType<any>;
const AdminFormResponsesScreen = FormResponsesScreen as React.ComponentType<any>;

const navTheme = {
  red: '#7657F7',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.92)',
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Auth Stack Navigator - Login & Register screens
 */
const AuthStackNavigator = () => {
  return (
    <AuthStack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

/**
 * App Stack Navigator - Main app screens after authentication
 */
const AppStackNavigator = () => {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: navTheme.surface,
        },
        headerTintColor: navTheme.red,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <AppStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: 'Dashboard',
          headerShown: false,
        }}
      />
      <AppStack.Screen
        name="FormsList"
        component={FormsListScreen}
        options={{
          headerTitle: 'My Forms',
          headerShown: false,
        }}
      />
      <AppStack.Screen
        name="FormCreate"
        component={FormCreateScreen}
        options={{
          headerTitle: 'Create Form',
          headerShown: false,
        }}
      />
      <AppStack.Screen
        name="AiStudio"
        component={AiStudioScreen}
        options={{
          headerTitle: 'AI Studio',
          headerShown: false,
        }}
      />
      <AppStack.Screen
        name="ResponseAnalyzer"
        component={ResponseAnalyzerScreen}
        options={{
          headerTitle: 'Response Analyzer',
          headerShown: false,
        }}
      />
      <AppStack.Screen
        name="FormDetail"
        component={FormDetailScreen}
        options={{
          headerTitle: 'Form Details',
          headerShown: false,
        }}
      />
      <AppStack.Screen
        name="FormPreview"
        component={FormPreviewScreen}
        options={{
          headerTitle: 'Preview',
        }}
      />
      <AppStack.Screen
        name="FormConditions"
        component={FormConditionsScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <AppStack.Screen
        name="BranchDetail"
        component={BranchDetailScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <AppStack.Screen
        name="FormShare"
        component={FormShareScreen}
        options={{
          headerTitle: 'Share Form',
        }}
      />
      <AppStack.Screen
        name="FormResponses"
        component={FormResponsesScreen}
        options={{
          headerTitle: 'Form Responses',
        }}
      />
      <AppStack.Screen
        name="FormVersionDetail"
        component={FormVersionDetailScreen}
        options={{
          headerTitle: 'Version Details',
        }}
      />
      <AppStack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          headerTitle: 'Analytics',
          headerShown: false,
        }}
      />
      <AppStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'Profile',
          headerShown: false,
        }}
      />
    </AppStack.Navigator>
  );
};

const AdminStackNavigator = () => {
  return (
    <AdminStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: navTheme.surface,
        },
        headerTintColor: navTheme.red,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <AdminStack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          headerTitle: 'Admin Dashboard',
          headerShown: false,
        }}
      />
      <AdminStack.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{
          headerTitle: 'User Management',
        }}
      />
      <AdminStack.Screen
        name="AdminForms"
        component={AdminFormsScreen}
        options={{
          headerTitle: 'All Forms',
        }}
      />
      <AdminStack.Screen
        name="AdminAnalytics"
        component={AdminAnalyticsScreen}
        options={{
          headerTitle: 'Analytics',
          headerShown: false,
        }}
      />
      <AdminStack.Screen
        name="AdminFormDetail"
        component={AdminFormDetailScreen}
        options={{
          headerTitle: 'Form Detail',
        }}
      />
      <AdminStack.Screen
        name="AdminFormResponses"
        component={AdminFormResponsesScreen}
        options={{
          headerTitle: 'Form Responses',
        }}
      />
      <AdminStack.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={{
          headerTitle: 'User Detail',
        }}
      />
    </AdminStack.Navigator>
  );
};

/**
 * Root Navigator - Main navigation logic
 * Handles auth screens and app screens without a splash gate.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [typeof window !== 'undefined' ? window.location.origin : 'http://localhost:19006'],
  config: {
    screens: {
      PublicForm: 'public/forms/:slug',
      AuthStack: {
        screens: {
          Login: 'login',
          Register: 'register',
        },
      },
      AppStack: {
        screens: {
          Dashboard: 'dashboard',
          FormsList: 'forms',
          FormCreate: 'forms/create',
          AiStudio: 'ai-studio',
          ResponseAnalyzer: 'response-analyzer',
          FormDetail: 'forms/detail/:formId',
          FormPreview: 'forms/detail/:formId/preview',
          FormConditions: 'forms/detail/:formId/conditions/:questionId',
          BranchDetail: 'forms/detail/:formId/branches/:triggerQuestionId',
          FormShare: 'forms/detail/:formId/share',
          FormResponses: 'forms/detail/:formId/responses',
          FormVersionDetail: 'forms/detail/:formId/versions/:versionNumber',
          Analytics: 'analytics',
          Profile: 'profile',
        },
      },
      AdminStack: {
        screens: {
          AdminDashboard: 'admin/dashboard',
          AdminUsers: 'admin/users',
          AdminForms: 'admin/forms',
          AdminAnalytics: 'admin/analytics',
          AdminFormDetail: 'admin/forms/detail/:formId',
          AdminFormResponses: 'admin/forms/detail/:formId/responses',
          AdminUserDetail: 'admin/users/:userId',
        },
      },
    },
  },
};

export const RootNavigator = () => {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeFormId, setActiveFormId] = useState<string | undefined>();
  const updateActiveForm = useCallback(() => {
    const route = navigationRef.getCurrentRoute();
    const params = route?.params as { formId?: string } | undefined;
    setActiveFormId(params?.formId);
  }, []);

  console.log('RootNavigator render:', { isAuthenticated });

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={updateActiveForm}
      onStateChange={updateActiveForm}
    >
      <View style={styles.navigationRoot}>
      <RootStack.Navigator
        key={isAuthenticated ? (isAdmin ? 'admin-stack' : 'app-stack') : 'auth-stack'}
        initialRouteName={isAuthenticated ? (isAdmin ? 'AdminStack' : 'AppStack') : 'AuthStack'}
        screenOptions={{
          headerShown: false,
          animation: 'default',
        }}
      >
        <RootStack.Screen
          name="AuthStack"
          component={AuthStackNavigator}
          options={{ animation: 'none' }}
        />
        <RootStack.Screen
          name="AppStack"
          component={AppStackNavigator}
          options={{ animation: 'none' }}
        />
        <RootStack.Screen
          name="AdminStack"
          component={AdminStackNavigator}
          options={{ animation: 'none' }}
        />
        <RootStack.Screen
          name="PublicForm"
          component={PublicFormScreen}
          options={{ headerShown: true, title: 'Public Form' }}
        />
      </RootStack.Navigator>
      {isAuthenticated ? <FloatingAiChat formId={activeFormId} /> : null}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  navigationRoot: {
    flex: 1,
  },
});
