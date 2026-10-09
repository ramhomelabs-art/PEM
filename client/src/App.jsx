import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/personal_expense/AuthContext';
import { ThemeProvider } from './context/personal_expense/ThemeContext';
import { CreditCardProvider } from './context/credit_card/CreditCardContext';
import { CardSessionProvider } from './context/credit_card/CardSessionContext';
import { CategoryProvider } from './context/CategoryContext';
import { SmartNotesProvider } from './context/personal_expense/SmartNotesContext';
import { ToastProvider } from './context/ToastContext';

import Layout from './components/personal_expense/Layout';
import CreditCardLayout from './components/credit_card/CreditCardLayout';
import SmartNotesPanel from './components/personal_expense/SmartNotesPanel';

// Eager load core authentication pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import MfaSetup from './pages/personal_expense/MfaSetup';
import MfaVerify from './pages/personal_expense/MfaVerify';
import CreditCardUnlock from './pages/credit_card/CreditCardUnlock';
import CreditCardLoading from './pages/credit_card/CreditCardLoading';

// Lazy load feature pages for optimal code splitting & fast initial loads
const Dashboard = lazy(() => import('./pages/personal_expense/Dashboard'));
const Admin = lazy(() => import('./pages/personal_expense/Admin'));
const Profile = lazy(() => import('./pages/personal_expense/Profile'));
const Transactions = lazy(() => import('./pages/personal_expense/Transactions'));
const Bills = lazy(() => import('./pages/personal_expense/Bills'));
const Loans = lazy(() => import('./pages/personal_expense/Loans'));
const Archive = lazy(() => import('./pages/personal_expense/Archive'));
const Borrow = lazy(() => import('./pages/personal_expense/Borrow'));
const Accounts = lazy(() => import('./pages/personal_expense/Accounts'));
const Budgets = lazy(() => import('./pages/personal_expense/Budgets'));
const Automation = lazy(() => import('./pages/personal_expense/Automation'));
const InvestmentDashboard = lazy(() => import('./pages/investment/InvestmentDashboard'));
const ServerManager = lazy(() => import('./pages/personal_expense/ServerManager'));
const MfaManager = lazy(() => import('./pages/personal_expense/MfaManager'));
const SharedView = lazy(() => import('./pages/personal_expense/SharedView'));

// Credit Card Feature Pages (Lazy)
const CreditCardDashboard = lazy(() => import('./pages/credit_card/CreditCardDashboard'));
const CreditCardsList = lazy(() => import('./pages/credit_card/CreditCardsList'));
const CreditCardTransactions = lazy(() => import('./pages/credit_card/CreditCardTransactions'));
const CreditCardSettings = lazy(() => import('./pages/credit_card/CreditCardSettings'));
const CreditCardEMI = lazy(() => import('./pages/credit_card/CreditCardEMI'));
const MonthlyBills = lazy(() => import('./pages/credit_card/MonthlyBills'));
const CreditCardAutoStatement = lazy(() => import('./pages/credit_card/CreditCardAutoStatement'));
const CreditCardRewards = lazy(() => import('./pages/credit_card/CreditCardRewards'));

const PrivateRoute = ({ children, role }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
};

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-sunken text-ink-muted">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      <span className="text-xs font-medium text-ink-muted">Loading module...</span>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <CategoryProvider>
            <CardSessionProvider>
              <CreditCardProvider>
                <SmartNotesProvider>
                  <Router>
                    <SmartNotesPanel />
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/mfa-setup" element={<MfaSetup />} />
                        <Route path="/mfa/setup" element={<MfaSetup />} />
                        <Route path="/mfa-verify" element={<MfaVerify />} />
                        <Route path="/mfa/verify" element={<MfaVerify />} />
                        <Route path="/signup" element={<Signup />} />

                        <Route
                          path="/"
                          element={
                            <PrivateRoute>
                              <Layout><Dashboard /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/admin"
                          element={
                            <PrivateRoute role="admin">
                              <Layout><Admin /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/admin/server-manager"
                          element={
                            <PrivateRoute role="admin">
                              <ServerManager />
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/admin/mfa"
                          element={
                            <PrivateRoute role="admin">
                              <Layout><MfaManager /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/mfa-manager"
                          element={
                            <PrivateRoute role="admin">
                              <Layout><MfaManager /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/profile"
                          element={
                            <PrivateRoute>
                              <Layout><Profile /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/transactions"
                          element={
                            <PrivateRoute>
                              <Layout><Transactions /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/bills"
                          element={
                            <PrivateRoute>
                              <Layout><Bills /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/loans"
                          element={
                            <PrivateRoute>
                              <Layout><Loans /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/archive"
                          element={
                            <PrivateRoute>
                              <Layout><Archive /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/borrow"
                          element={
                            <PrivateRoute>
                              <Layout><Borrow /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/budgets"
                          element={
                            <PrivateRoute>
                              <Layout><Budgets /></Layout>
                            </PrivateRoute>
                          }
                        />

                        <Route
                          path="/cards"
                          element={
                            <PrivateRoute>
                              <Layout><Accounts /></Layout>
                            </PrivateRoute>
                          }
                        />

                        {/* Credit Cards Section */}
                        <Route path="/credit-cards">
                          <Route
                            index
                            element={
                              <PrivateRoute>
                                <CreditCardUnlock />
                              </PrivateRoute>
                            }
                          />

                          <Route
                            path="loading"
                            element={
                              <PrivateRoute>
                                <CreditCardLoading />
                              </PrivateRoute>
                            }
                          />

                          <Route
                            element={
                              <PrivateRoute>
                                <CreditCardLayout />
                              </PrivateRoute>
                            }
                          >
                            <Route path="dashboard" element={<CreditCardDashboard />} />
                            <Route path="cards" element={<CreditCardsList />} />
                            <Route path="transactions" element={<CreditCardTransactions />} />
                            <Route path="emi" element={<CreditCardEMI />} />
                            <Route path="auto-statement" element={<CreditCardAutoStatement />} />
                            <Route path="monthly-bills" element={<MonthlyBills />} />
                            <Route path="rewards" element={<CreditCardRewards />} />
                            <Route path="settings" element={<CreditCardSettings />} />
                          </Route>
                        </Route>

                        {/* Automation */}
                        <Route
                          path="/automation"
                          element={
                            <PrivateRoute>
                              <Layout><Automation /></Layout>
                            </PrivateRoute>
                          }
                        />

                        {/* Investment Portfolio */}
                        <Route
                          path="/investments"
                          element={
                            <PrivateRoute>
                              <Layout><InvestmentDashboard /></Layout>
                            </PrivateRoute>
                          }
                        />

                        {/* Shared Resource View */}
                        <Route
                          path="/shared/:shareId"
                          element={
                            <PrivateRoute>
                              <SharedView />
                            </PrivateRoute>
                          }
                        />
                      </Routes>
                    </Suspense>
                  </Router>
                </SmartNotesProvider>
              </CreditCardProvider>
            </CardSessionProvider>
          </CategoryProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
