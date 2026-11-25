import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// 页面引入
import HomeScreen from '../screens/HomeScreen';
import FlightListScreen from '../screens/Flights/FlightListScreen';
import MyTripsScreen from '../screens/MyTripsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchFlightScreen from '../screens/SearchFlightScreen';
import FlightResultsScreen from '../screens/Flights/FlightResultsScreen';
import FlightDetailScreen from '../screens/Flights/FlightDetailScreen';

import { TabIcon } from '../components/TabIcon';
import { navigationRef } from './navigationRef';

// 1. 定义路由参数类型
export type BottomTabParamList = {
  HomeTab: undefined;
  FlightsTab: undefined;
  MyTripsTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  SearchFlight: undefined;
  FlightResults: { searchParams?: any };
  FlightDetail: { flightId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Bottom = createBottomTabNavigator<BottomTabParamList>();

function BottomTabNavigator() {
  return (
    <Bottom.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <Bottom.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          headerShown: false,
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Bottom.Screen
        name="FlightsTab"
        component={FlightListScreen}
        options={{
          title: 'Flight List',
          tabBarLabel: 'Flights',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="airplane" focused={focused} />
          ),
        }}
      />
      <Bottom.Screen
        name="MyTripsTab"
        component={MyTripsScreen}
        options={{
          title: 'My Trips',
          tabBarLabel: 'My Trips',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="briefcase" focused={focused} />
          ),
        }}
      />
      <Bottom.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="person" focused={focused} />
          ),
        }}
      />
    </Bottom.Navigator>
  );
}

// Root Navigation
export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
        {/* 底部 Tab 主界面 */}
        <Stack.Screen
          name="MainTabs"
          component={BottomTabNavigator}
          options={{ headerShown: false }}
        />
        {/* 二级功能页面 */}
        <Stack.Screen
          name="SearchFlight"
          component={SearchFlightScreen}
          options={{ title: 'Search Flights' }}
        />
        <Stack.Screen
          name="FlightResults"
          component={FlightResultsScreen}
          options={{ title: 'Flight Results' }}
        />
        <Stack.Screen
          name="FlightDetail"
          component={FlightDetailScreen}
          options={{ title: 'Flight Details' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
