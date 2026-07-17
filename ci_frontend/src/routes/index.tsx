import { createBrowserRouter } from 'react-router-dom';
import { GuestLayout } from '../layouts/GuestLayout';
import { ProtectedLayout } from '../layouts/ProtectedLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { SplashPage } from '../features/auth/pages/SplashPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { ContactsListPage } from '../features/contacts/pages/ContactsListPage';
import { ContactDetailPage } from '../features/contacts/pages/ContactDetailPage';
import { ScannerPage } from '../features/scanner/pages/ScannerPage';
import { QrScannerPage } from '../features/qr/pages/QrScannerPage';
import { NfcReaderPage } from '../features/nfc/pages/NfcReaderPage';
import { FaceMatchPage } from '../features/face/pages/FaceMatchPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  // Public Splash page landing
  {
    path: '/',
    element: <SplashPage />,
  },
  // Guest Authentication Routes
  {
    element: <GuestLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
      },
    ],
  },
  // Private Authorized App Routes
  {
    element: <ProtectedLayout />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/contacts',
            element: <ContactsListPage />,
          },
          {
            path: '/contacts/:id',
            element: <ContactDetailPage />,
          },
          {
            path: '/scanner',
            element: <ScannerPage />,
          },
          {
            path: '/qr',
            element: <QrScannerPage />,
          },
          {
            path: '/nfc',
            element: <NfcReaderPage />,
          },
          {
            path: '/face',
            element: <FaceMatchPage />,
          },
        ],
      },
    ],
  },
  // 404 fallback route
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
