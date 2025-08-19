import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, query, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import {
  DollarSign,
  Truck,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Printer,
  Search,
  History as HistoryIcon,
  Upload,
  Settings as SettingsIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Tailwind CSS classes for consistent styling
const containerClass = "bg-slate-50 min-h-screen p-4 sm:p-8 flex flex-col items-center font-sans";
const cardClass = "bg-white shadow-xl rounded-2xl p-6 sm:p-8 mb-6 w-full max-w-6xl";
const buttonClass = "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition-colors duration-200 shadow-md";
const inputClass = "w-full p-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200";
const tableClass = "min-w-full divide-y divide-gray-200";
const headerClass = "bg-gray-50";
const thClass = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
const tdClass = "px-6 py-4 whitespace-nowrap text-sm text-gray-900";

// Exchange rate default
const PLN_TO_CZK_RATE_DEFAULT = 5.6;

const Views = {
  TRANSACTIONS: 'transactions',
  PERSONNEL: 'personnel',
  DELIVERY_FILTER: 'delivery-filter',
  SALES_GRAPH: 'sales-graph',
  HISTORY: 'history',
  IMPORT: 'import',
  SETTINGS: 'settings',
  SALES_OVERVIEW: 'sales_overview'
,
  OLD_ENGINES: 'OLD_ENGINES'
};

// Read env
const __app_id = import.meta.env.VITE_APP_ID || 'default-app-id';
const __firebase_config = import.meta.env.VITE_FIREBASE_CONFIG || '{}';
const __initial_auth_token = import.meta.env.VITE_INITIAL_AUTH_TOKEN || '';

// Main App Component
const App = () => {
  const [currentView, setCurrentView] = useState(Views.TRANSACTIONS);
  const [transactions, setTransactions] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [history, setHistory] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(PLN_TO_CZK_RATE_DEFAULT);

  // Helper functions for date calculations
  const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `T${weekNo}`;
  };

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(d.setDate(diff));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const startDateString = startOfWeek.toLocaleDateString('cs-CZ', options);
    const endDateString = endOfWeek.toLocaleDateString('cs-CZ', options);
    return `${startDateString} - ${endDateString}`;
  };

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfig = JSON.parse(__firebase_config);
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
          console.error("Firebase config is missing.");
          setIsLoading(false);
          return;
        }

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        setDb(firestore);

        if (__initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        auth.onAuthStateChanged(user => {
          if (user) {
            setUserId(user.uid);
            setIsAuthReady(true);
          } else {
            setUserId(null);
            setIsAuthReady(true);
          }
          setIsLoading(false);
        });
      } catch (e) {
        console.error("Error during Firebase initialization or sign-in:", e);
        setIsLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  // Fetch data from Firestore once authenticated
  useEffect(() => {
    if (db && userId) {
      const unsubTransactions = onSnapshot(
        query(collection(db, `/artifacts/${__app_id}/public/data/transactions`)),
        (snapshot) => {
          const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTransactions(fetched);
        },
        (error) => console.error("Error fetching transactions:", error)
      );

      const unsubSellers = onSnapshot(
        query(collection(db, `/artifacts/${__app_id}/public/data/sellers`)),
        (snapshot) => setSellers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
        (error) => console.error("Error fetching sellers:", error)
      );

      const unsubDrivers = onSnapshot(
        query(collection(db, `/artifacts/${__app_id}/public/data/drivers`)),
        (snapshot) => setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
        (error) => console.error("Error fetching drivers:", error)
      );

      const unsubHistory = onSnapshot(
        query(collection(db, `/artifacts/${__app_id}/public/data/history`)),
        (snapshot) => setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
        (error) => console.error("Error fetching history:", error)
      );

      const unsubSettings = onSnapshot(
        query(collection(db, `/artifacts/${__app_id}/public/data/settings`)),
        (snapshot) => {
          const settings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const rateSetting = settings.find(s => s.id === 'exchangeRate');
          if (rateSetting && rateSetting.value) {
            setExchangeRate(parseFloat(rateSetting.value));
          }
        },
        (error) => console.error("Error fetching settings:", error)
      );

      return () => {
        unsubTransactions();
        unsubSellers();
        unsubDrivers();
        unsubHistory();
        unsubSettings();
      };
    }
  }, [db, userId]);

  if (isLoading || !isAuthReady) {
    return <div className="flex justify-center items-center h-screen text-lg">Načítání aplikace...</div>;
  }

  // --- Components for each view ---

  const TransactionsView = ({ sellers, drivers, db, transactions }) => {
    // Helpers for formatting
    const formatPhone = (raw) => {
      const s = String(raw || '').replace(/\D+/g, '');
      if (!s) return '-';
      if (s.startsWith('420')) {
        const rest = s.slice(3);
        const grouped = rest.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        return '+420 ' + grouped;
      }
      return s.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    };

    const [newItem, setNewItem] = useState({
            deliveryCity: '',
      customerPhone2: '',
itemName: '',
      brand: '',
      model: '',
      purchasePricePln: '',
      sellingPriceCzk: '',
      saleDate: new Date().toISOString().slice(0, 10),
      seller: '',
      supplier: '',
      note: '',
            driver: '',
      customerName: '',
      customerAddress: '',
      customerContact: '',
      netProfitCzk: 0,
    });
    const [isEditing, setIsEditing] = useState(false);
    const [currentEditId, setCurrentEditId] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [filterSeller, setFilterSeller] = useState('');
    const [filterDriver, setFilterDriver] = useState('');
    const [weekOffset, setWeekOffset] = useState(0);

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      const updatedItem = { ...newItem, [name]: value };

      const purchasePrice = parseFloat(updatedItem.purchasePricePln) || 0;
      const sellingPrice = parseFloat(updatedItem.sellingPriceCzk) || 0;
      const purchasePriceCzk = purchasePrice * exchangeRate;
      const netProfit = sellingPrice - purchasePriceCzk;

      setNewItem({ ...updatedItem, netProfitCzk: netProfit.toFixed(2) });
    };

    const handleSaveItem = async () => {
      if (!newItem.itemName || !newItem.purchasePricePln || !newItem.sellingPriceCzk || !newItem.seller) {
        window.alert("Prosím vyplňte všechna povinná pole (Název, Nákup, Prodej, Prodejce).");
        return;
      }

      if (isEditing && currentEditId) {
        const transactionRef = doc(db, `/artifacts/${__app_id}/public/data/transactions`, currentEditId);
        try {
          await updateDoc(transactionRef, {
            ...newItem,
            purchasePricePln: parseFloat(newItem.purchasePricePln),
            sellingPriceCzk: parseFloat(newItem.sellingPriceCzk),
            netProfitCzk: parseFloat(newItem.netProfitCzk),
          });
          await addDoc(collection(db, `/artifacts/${__app_id}/public/data/history`), {
            action: 'Upraveno',
            docId: currentEditId,
            details: `Položka '${newItem.itemName}' byla upravena.`,
            timestamp: serverTimestamp(),
          });
          setIsEditing(false);
          setCurrentEditId(null);
        } catch (e) {
          console.error("Error updating document: ", e);
        }
      } else {
        try {
          const docRef = await addDoc(collection(db, `/artifacts/${__app_id}/public/data/transactions`), {
            ...newItem,
            purchasePricePln: parseFloat(newItem.purchasePricePln),
            sellingPriceCzk: parseFloat(newItem.sellingPriceCzk),
            netProfitCzk: parseFloat(newItem.netProfitCzk),
            createdAt: serverTimestamp(),
          });
          await addDoc(collection(db, `/artifacts/${__app_id}/public/data/history`), {
            action: 'Přidáno',
            docId: docRef.id,
            details: `Nová položka '${newItem.itemName}' byla přidána.`,
            timestamp: serverTimestamp(),
          });
        } catch (e) {
          console.error("Error adding document: ", e);
        }
      }

      setNewItem({
        itemName: '',
        brand: '',
        model: '',
        purchasePricePln: '',
        sellingPriceCzk: '',
        saleDate: new Date().toISOString().slice(0, 10),
        seller: '',
        supplier: '',
        note: '',
                driver: '',
        customerName: '',
        customerAddress: '',
        customerContact: '',
        netProfitCzk: 0,
      });
    };

    const handleEditItem = (item) => {
      setNewItem({
        itemName: item.itemName,
        brand: item.brand || '',
        model: item.model || '',
        purchasePricePln: item.purchasePricePln?.toString() || '',
        sellingPriceCzk: item.sellingPriceCzk?.toString() || '',
        saleDate: item.saleDate || new Date().toISOString().slice(0, 10),
        seller: item.seller || '',
        supplier: item.supplier || '',
        note: item.note || '',
        destination: item.destination || '',
        driver: item.driver || '',
        customerName: item.customerName || '',
        customerAddress: item.customerAddress || '',
        customerContact: item.customerContact || '',
        customerPhone2: item.customerPhone2 || '',
        netProfitCzk: (item.netProfitCzk ?? 0).toString(),
      });
      setIsEditing(true);
      setCurrentEditId(item.id);
    };

    const handleDeleteItem = async (id) => {
      const confirmDelete = window.confirm("Opravdu chcete smazat tento záznam?");
      if (confirmDelete) {
        const transactionRef = doc(db, `/artifacts/${__app_id}/public/data/transactions`, id);
        try {
          await deleteDoc(transactionRef);
          await addDoc(collection(db, `/artifacts/${__app_id}/public/data/history`), {
            action: 'Smazáno',
            docId: id,
            details: `Položka (ID: ${id}) byla smazána.`,
            timestamp: serverTimestamp(),
          });
        } catch (e) {
          console.error("Error deleting document: ", e);
        }
      }
    };

    const handleCancelEdit = () => {
      setIsEditing(false);
      setCurrentEditId(null);
      setNewItem({
        itemName: '',
        brand: '',
        model: '',
        purchasePricePln: '',
        sellingPriceCzk: '',
        saleDate: new Date().toISOString().slice(0, 10),
        seller: '',
        supplier: '',
        note: '',
                driver: '',
        customerName: '',
        customerAddress: '',
        customerContact: '',
        netProfitCzk: 0,
      });
    };
    
    // Filtering by week
    const today = new Date();
    const startOfCurrentWeek = getStartOfWeek(today);
    const targetWeekStart = new Date(startOfCurrentWeek);
    targetWeekStart.setDate(startOfCurrentWeek.getDate() + weekOffset * 7);
    const endOfTargetWeek = new Date(targetWeekStart);
    endOfTargetWeek.setDate(targetWeekStart.getDate() + 7);
    
    const weekTransactions = transactions.filter(t => {
      if (!t.saleDate) return false;
      const transactionDate = new Date(t.saleDate);
      return transactionDate >= targetWeekStart && transactionDate < endOfTargetWeek;
    });

    const filteredTransactions = weekTransactions.filter(t => {
      const textMatch = (filterText || '').toLowerCase();
      const fields = [t.itemName, t.supplier, t.customerName, t.brand, t.model].map(v => (v || '').toLowerCase());
      const [item, supplier, customer, brand, model] = fields;
      const sellerFilterMatch = filterSeller === '' || t.seller === filterSeller;
      const driverFilterMatch = filterDriver === '' || t.driver === filterDriver;
      return (item.includes(textMatch) || supplier.includes(textMatch) || customer.includes(textMatch) || brand.includes(textMatch) || model.includes(textMatch)) && sellerFilterMatch && driverFilterMatch;
    });

    const handlePreviousWeek = () => setWeekOffset(prev => prev - 1);
    const handleNextWeek = () => setWeekOffset(prev => prev + 1);

    const handleMoveItemToNextWeek = async (item) => {
      const itemRef = doc(db, `/artifacts/${__app_id}/public/data/transactions`, item.id);
      const saleDate = new Date(item.saleDate);
      saleDate.setDate(saleDate.getDate() + 7);
      const newSaleDate = saleDate.toISOString().slice(0, 10);
      try {
        await updateDoc(itemRef, { saleDate: newSaleDate });
        await addDoc(collection(db, `/artifacts/${__app_id}/public/data/history`), {
          action: 'Posunuto o týden',
          docId: item.id,
          details: `Položka '${item.itemName}' posunuta na týden: ${getWeekNumber(saleDate)}.`,
          timestamp: serverTimestamp(),
        });
      } catch (e) {
        console.error("Error moving item to next week: ", e);
      }
    };

    const weekNumber = getWeekNumber(targetWeekStart);

    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
            <DollarSign className="mr-2 text-indigo-500" /> Nákupy, prodeje, rozvozy & zákazníci
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Směnný kurz PLN k CZK</label>
              <input type="number" name="exchangeRate" value={exchangeRate} onChange={(e) => setExchangeRate(parseFloat(e.target.value) || PLN_TO_CZK_RATE_DEFAULT)} placeholder={PLN_TO_CZK_RATE_DEFAULT} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Název položky</label>
              <input type="text" name="itemName" value={newItem.itemName} onChange={handleInputChange} placeholder="Např. Motor 1.9 TDI" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Značka</label>
              <input type="text" name="brand" value={newItem.brand} onChange={handleInputChange} placeholder="Např. Škoda" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input type="text" name="model" value={newItem.model} onChange={handleInputChange} placeholder="Např. Octavia" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nákup (PLN)</label>
              <input type="number" name="purchasePricePln" value={newItem.purchasePricePln} onChange={handleInputChange} placeholder="Např. 1000" className={inputClass} />
              <p className="text-xs text-gray-500 mt-1">~ {(parseFloat(newItem.purchasePricePln || 0) * exchangeRate).toFixed(2)} CZK</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prodej (CZK)</label>
              <input type="number" name="sellingPriceCzk" value={newItem.sellingPriceCzk} onChange={handleInputChange} placeholder="Např. 6000" className={inputClass} />
              <p className="text-xs font-medium text-gray-500 mt-1">Čistý zisk: <span className="font-bold text-indigo-600">{newItem.netProfitCzk} CZK</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum prodeje</label>
              <input type="date" name="saleDate" value={newItem.saleDate} onChange={handleInputChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kdo prodal</label>
              <select name="seller" value={newItem.seller} onChange={handleInputChange} className={inputClass}>
                <option value="">Vyberte jméno</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.name}>{seller.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dodavatel</label>
              <input type="text" name="supplier" value={newItem.supplier} onChange={handleInputChange} placeholder="Např. Autodíly PL" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poznámka</label>
              <input type="text" name="note" value={newItem.note} onChange={handleInputChange} placeholder="Např. prasklý plast" className={inputClass} />
            </div>
            <div>
                          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Město</label>
              <input type="text" name="deliveryCity" value={newItem.deliveryCity} onChange={handleInputChange} placeholder="Např. Pardubice" className={inputClass} />
            </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rozvoz (Řidič)</label>
              <select name="driver" value={newItem.driver} onChange={handleInputChange} className={inputClass}>
                <option value="">Vyberte řidiče</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.name}>{driver.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zákazník (Jméno)</label>
              <input type="text" name="customerName" value={newItem.customerName} onChange={handleInputChange} placeholder="Např. Jan Novák" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zákazník (Adresa)</label>
              <input type="text" name="customerAddress" value={newItem.customerAddress} onChange={handleInputChange} placeholder="Např. Hlavní 123" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zákazník (Kontakt)</label>
              <input type="text" name="customerContact" value={newItem.customerContact} onChange={handleInputChange} placeholder="Např. 777 123 456" className={inputClass} autoComplete="tel" inputMode="tel" pattern="[\d\s+]*" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefonní kontakt 2</label>
              <input type="text" name="customerPhone2" value={newItem.customerPhone2} onChange={handleInputChange} placeholder="Např. 606 123 456" className={inputClass} autoComplete="tel-secondary" inputMode="tel" pattern="[\d\s+]*" />
            </div>
          </div>
          <div className="flex space-x-2">
            <button onClick={handleSaveItem} className={buttonClass}>
              {isEditing ? <><Save className="inline mr-2 h-4 w-4" />Uložit změny</> : <><Plus className="inline mr-2 h-4 w-4" />Přidat záznam</>}
            </button>
            {isEditing && (
              <button onClick={handleCancelEdit} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-xl transition-colors duration-200 shadow-md">
                <X className="inline mr-2 h-4 w-4" />Zrušit
              </button>
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Seznam záznamů</h3>
          <div className="flex justify-between items-center mb-4">
              <button onClick={handlePreviousWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <span className="text-lg font-semibold">{getWeekNumber(targetWeekStart)} ({getWeekRange(targetWeekStart)})</span>
              <button onClick={handleNextWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
          </div>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Hledat v názvu / zákazníkovi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input type="text" value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Hledat..." className={`${inputClass} pl-10`} />
              </div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filtrovat dle prodejce</label>
              <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)} className={inputClass}>
                <option value="">Všichni</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.name}>{seller.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filtrovat dle řidiče</label>
              <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} className={inputClass}>
                <option value="">Všichni</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.name}>{driver.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* SUMMARY_CARDS_START */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-indigo-50 rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-600">Nákup (CZK)</div>
              <div className="text-2xl font-bold">{Number(filteredTransactions.reduce((s,t)=> s + (parseFloat(t.purchasePricePln||0)*exchangeRate),0)).toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-600">Prodej (CZK)</div>
              <div className="text-2xl font-bold">{Number(filteredTransactions.reduce((s,t)=> s + (parseFloat(t.sellingPriceCzk||0)),0)).toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-600">Čistý zisk (CZK)</div>
              <div className="text-2xl font-bold">{Number(filteredTransactions.reduce((s,t)=> s + (parseFloat(t.netProfitCzk||0)),0)).toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-600">Počet záznamů</div>
              <div className="text-2xl font-bold">{filteredTransactions.length}</div>
            </div>
          </div>
          {/* SUMMARY_CARDS_END */}
<div className="overflow-x-auto">
            <table className={tableClass}>
              
              <thead className={headerClass}>
                <tr>
                  <th className={thClass}>Datum prodeje</th>
                  <th className={thClass}>Položka</th>
                  <th className={thClass}>Značka</th>
                  <th className={thClass}>Model</th>
                  <th className={thClass}>Poznámka</th>
                  <th className={thClass}>Prodejce</th>
                  <th className={thClass}>Dodavatel</th>
                  <th className={thClass}>Nákup (CZK)</th>
                  <th className={thClass}>Prodej (CZK)</th>
                  <th className={thClass}>Zisk</th>
                  <th className={thClass}>Město</th>
                  <th className={thClass}>Adresa zákazníka</th>
                  <th className={thClass}>Zák. Tel.</th>
                  <th className={thClass}>Akce</th>
                </tr>
              </thead>

              
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions
                  .sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate))
                  .map(item => (
                  <tr key={item.id}>
                    <td className={tdClass}>{item.saleDate || '-'}</td>
                    <td className={tdClass}>{item.itemName || '-'}</td>
                    <td className={tdClass}>{item.brand || '-'}</td>
                    <td className={tdClass}>{item.model || '-'}</td>
                    <td className={tdClass}>{item.note || '-'}</td>
                    <td className={tdClass}>{item.seller || '-'}</td>
                    <td className={tdClass}>{item.supplier || '-'}</td>
                    <td className={tdClass}>{Number((parseFloat(item.purchasePricePln || 0) * exchangeRate) || 0).toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className={tdClass}>{Number(item.sellingPriceCzk || 0).toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className={tdClass}>
                      <span className={`font-bold ${item.netProfitCzk > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(item.netProfitCzk || 0).toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CZK
                      </span>
                    </td>
                    <td className={tdClass}>{item.deliveryCity || '-'}</td>
                    <td className={tdClass}>{item.customerAddress || '-'}</td>
                    <td className={tdClass}>
                      <div>{formatPhone(item.customerContact)}</div>
                      {item.customerPhone2 ? <div className="text-gray-500">{formatPhone(item.customerPhone2)}</div> : null}
                    </td>
                    <td className={tdClass}>
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditItem(item)} className="text-indigo-600 hover:text-indigo-900" aria-label="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-900" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleMoveItemToNextWeek(item)} className="text-blue-600 hover:text-blue-900" aria-label="Move Next Week" title="Posunout o týden">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </div>
      </div>
    );
  };

  const PersonnelView = ({ sellers, drivers, db }) => {
    const [newSeller, setNewSeller] = useState('');
    const [newDriver, setNewDriver] = useState('');
    const [isEditingSeller, setIsEditingSeller] = useState(false);
    const [currentEditSellerId, setCurrentEditSellerId] = useState(null);
    const [isEditingDriver, setIsEditingDriver] = useState(false);
    const [currentEditDriverId, setCurrentEditDriverId] = useState(null);

    const handleSaveSeller = async () => {
      if (!newSeller.trim()) {
        window.alert("Prosím zadejte jméno.");
        return;
      }

      if (isEditingSeller && currentEditSellerId) {
        const sellerRef = doc(db, `/artifacts/${__app_id}/public/data/sellers`, currentEditSellerId);
        try {
          await updateDoc(sellerRef, { name: newSeller.trim() });
          setIsEditingSeller(false);
          setCurrentEditSellerId(null);
        } catch (e) {
          console.error("Error updating seller: ", e);
        }
      } else {
        try {
          await addDoc(collection(db, `/artifacts/${__app_id}/public/data/sellers`), {
            name: newSeller.trim(),
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error("Error adding seller: ", e);
        }
      }
      setNewSeller('');
    };

    const handleEditSeller = (seller) => {
      setNewSeller(seller.name);
      setIsEditingSeller(true);
      setCurrentEditSellerId(seller.id);
    };

    const handleDeleteSeller = async (id) => {
      const confirmDelete = window.confirm("Opravdu chcete smazat tohoto prodejce?");
      if (confirmDelete) {
        const sellerRef = doc(db, `/artifacts/${__app_id}/public/data/sellers`, id);
        try {
          await deleteDoc(sellerRef);
        } catch (e) {
          console.error("Error deleting seller: ", e);
        }
      }
    };

    const handleSaveDriver = async () => {
      if (!newDriver.trim()) {
        window.alert("Prosím zadejte jméno.");
        return;
      }
      if (isEditingDriver && currentEditDriverId) {
        const driverRef = doc(db, `/artifacts/${__app_id}/public/data/drivers`, currentEditDriverId);
        try {
          await updateDoc(driverRef, { name: newDriver.trim() });
          setIsEditingDriver(false);
          setCurrentEditDriverId(null);
        } catch (e) {
          console.error("Error updating driver: ", e);
        }
      } else {
        try {
          await addDoc(collection(db, `/artifacts/${__app_id}/public/data/drivers`), {
            name: newDriver.trim(),
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error("Error adding driver: ", e);
        }
      }
      setNewDriver('');
    };

    const handleEditDriver = (driver) => {
      setNewDriver(driver.name);
      setIsEditingDriver(true);
      setCurrentEditDriverId(driver.id);
    };

    const handleDeleteDriver = async (id) => {
      const confirmDelete = window.confirm("Opravdu chcete smazat tohoto řidiče?");
      if (confirmDelete) {
        const driverRef = doc(db, `/artifacts/${__app_id}/public/data/drivers`, id);
        try {
          await deleteDoc(driverRef);
        } catch (e) {
          console.error("Error deleting driver: ", e);
        }
      }
    };

    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
            <Briefcase className="mr-2 text-indigo-500" /> Správa prodejců
          </h2>
          <div className="flex gap-2 mb-4">
            <input type="text" name="newSeller" value={newSeller} onChange={(e) => setNewSeller(e.target.value)} placeholder="Jméno prodejce" className={inputClass} />
            <button onClick={handleSaveSeller} className={buttonClass}>
              {isEditingSeller ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
            {isEditingSeller && (
              <button onClick={() => { setNewSeller(''); setIsEditingSeller(false); setCurrentEditSellerId(null); }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-xl transition-colors duration-200 shadow-md">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headerClass}>
                <tr>
                  <th className={thClass}>Jméno</th>
                  <th className={thClass}>Akce</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sellers.sort((a, b) => a.name.localeCompare(b.name)).map(seller => (
                  <tr key={seller.id}>
                    <td className={tdClass}>{seller.name}</td>
                    <td className={tdClass}>
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditSeller(seller)} className="text-indigo-600 hover:text-indigo-900" aria-label="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteSeller(seller.id)} className="text-red-600 hover:text-red-900" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
            <Truck className="mr-2 text-indigo-500" /> Správa řidičů
          </h2>
          <div className="flex gap-2 mb-4">
            <input type="text" name="newDriver" value={newDriver} onChange={(e) => setNewDriver(e.target.value)} placeholder="Jméno řidiče" className={inputClass} />
            <button onClick={handleSaveDriver} className={buttonClass}>
              {isEditingDriver ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
            {isEditingDriver && (
              <button onClick={() => { setNewDriver(''); setIsEditingDriver(false); setCurrentEditDriverId(null); }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-xl transition-colors duration-200 shadow-md">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headerClass}>
                <tr>
                  <th className={thClass}>Jméno</th>
                  <th className={thClass}>Akce</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drivers.sort((a, b) => a.name.localeCompare(b.name)).map(driver => (
                  <tr key={driver.id}>
                    <td className={tdClass}>{driver.name}</td>
                    <td className={tdClass}>
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditDriver(driver)} className="text-indigo-600 hover:text-indigo-900" aria-label="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteDriver(driver.id)} className="text-red-600 hover:text-red-900" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const DeliveryFilterView = ({ transactions, drivers }) => {
    const escapeHtml = (str) => String(str).replace(/[&<>"\']/g, (s) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\'":"&#39;" }[s]));
    const [selectedDriver, setSelectedDriver] = useState('');
    const [filteredDeliveries, setFilteredDeliveries] = useState([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [weekNumber, setWeekNumber] = useState('');

    useEffect(() => {
        if (!selectedDriver) {
            setFilteredDeliveries([]);
            setWeekNumber('');
            return;
        }

        const today = new Date();
        const startOfCurrentWeek = getStartOfWeek(today);

        const targetWeekStart = new Date(startOfCurrentWeek);
        targetWeekStart.setDate(startOfCurrentWeek.getDate() + weekOffset * 7);

        const endOfTargetWeek = new Date(targetWeekStart);
        endOfTargetWeek.setDate(targetWeekStart.getDate() + 7);

        const weeklyDeliveries = transactions.filter(t => {
            if (!t.driver || !t.destination || !t.createdAt) return false;
            const transactionDate = t.createdAt.toDate();
            return t.driver === selectedDriver && transactionDate >= targetWeekStart && transactionDate < endOfTargetWeek;
        });

        setFilteredDeliveries(weeklyDeliveries);
        setWeekNumber(getWeekNumber(targetWeekStart));
    }, [selectedDriver, transactions, weekOffset]);

    const handlePreviousWeek = () => setWeekOffset(prev => prev - 1);
    const handleNextWeek = () => setWeekOffset(prev => prev + 1);

    const handlePrint = () => {
      const formatCurrency = (n) => Number(n || 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const formatPhone = (raw) => {
        const s = String(raw || '').replace(/\D+/g, '');
        if (!s) return '-';
        if (s.startsWith('420')) {
          const rest = s.slice(3);
          const grouped = rest.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
          return '+420 ' + grouped;
        }
        return s.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
      };
      const rows = filteredDeliveries.map((d, idx) => {
        const tel1 = formatPhone(d.customerContact);
        const tel2 = d.customerPhone2 ? formatPhone(d.customerPhone2) : '';
        const telHtml = tel2 ? `${tel1} / ${tel2}` : tel1;
        const city = d.deliveryCity || '-';
        const addr = d.customerAddress || '-';
        const note = d.note || '-';
        const item = d.itemName || '-';
        const seller = d.seller || '-';
        const price = formatCurrency(d.sellingPriceCzk);
        return `
          <tr>
            <td>${idx+1}</td>
            <td>${item}</td>
            <td>${note}</td>
            <td>${seller}</td>
            <td style="text-align:right">${price}</td>
            <td>${city}</td>
            <td>${addr}</td>
            <td><span style="white-space:nowrap;">${telHtml}</span></td>
          </tr>`;
      }).join('');
      const title = `Seznam rozvozů pro ${selectedDriver} - ${weekNumber}`;
      const printContents = `
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: 'Inter', sans-serif; margin: 20px; color: #333; }
              h1 { font-size: 24px; margin-bottom: 12px; color: #1e3a8a; }
              .sub { font-size: 14px; color: #6b7280; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px 10px; vertical-align: top; }
              th { background-color: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 11px; }
              td { font-size: 13px; }
              td:nth-child(5) { text-align: right; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div class="sub">Týden: ${weekNumber} &nbsp;•&nbsp; Řidič: ${selectedDriver}</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Položka</th>
                  <th>Poznámka</th>
                  <th>Kdo prodal</th>
                  <th>Prodej (Kč)</th>
                  <th>Město</th>
                  <th>Adresa zákazníka</th>
                  <th>Telefon</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(printContents);
      w.document.close();
      w.focus();
      w.print();
    };

    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
            <Truck className="mr-2 text-indigo-500" /> Přehled rozvozů
          </h2>
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Vyberte řidiče</label>
              <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} className={inputClass}>
                <option value="">Vyberte řidiče</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.name}>{driver.name}</option>
                ))}
              </select>
            </div>
            <div className="flex space-x-2">
                <button onClick={handlePrint} className="flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-xl transition-colors duration-200 shadow-md">
                    <Printer className="h-5 w-5 mr-1" /> Tisk
                </button>
            </div>
          </div>
          {selectedDriver && (
            <div className="flex justify-between items-center mb-4">
              <button onClick={handlePreviousWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <span className="text-lg font-semibold">{weekNumber}</span>
              <button onClick={handleNextWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          )}
          {selectedDriver && filteredDeliveries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead className={headerClass}>
                  <tr>
                    <th>Položka</th>
                    <th>Značka</th>
                    <th>Model</th>
                    <th>Prodejní částka</th>
                    <th>Město</th>
                    <th>Zákazník</th>
                    <th>Adresa</th>
                    <th>Kontakt</th>
                    <th>Poznámka</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDeliveries.map(delivery => (
                    <tr key={delivery.id}>
                      <td>{delivery.itemName}</td>
                      <td>{delivery.brand || '-'}</td>
                      <td>{delivery.model || '-'}</td>
                      <td>{delivery.sellingPriceCzk} CZK</td>
                      <td>{delivery.destination || '-'}</td>
                      <td>{delivery.customerName || '-'}</td>
                      <td>{delivery.customerAddress || '-'}</td>
                      <td>{delivery.customerContact || '-'}</td>
                      <td>{delivery.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedDriver ? (
            <div className="text-center text-gray-500 mt-4">Žádné rozvozy pro tohoto řidiče v daném týdnu.</div>
          ) : null}
        </div>
      </div>
    );
  };

  const SalesGraphView = ({ transactions, sellers }) => {
    const [weekOffset, setWeekOffset] = useState(0);
    const [chartData, setChartData] = useState([]);
    const [weekRange, setWeekRange] = useState('');

    useEffect(() => {
      const today = new Date();
      const startOfCurrentWeek = getStartOfWeek(today);

      const targetWeekStart = new Date(startOfCurrentWeek);
      targetWeekStart.setDate(startOfCurrentWeek.getDate() + weekOffset * 7);

      const endOfTargetWeek = new Date(targetWeekStart);
      endOfTargetWeek.setDate(targetWeekStart.getDate() + 7);
      const weeklyTransactions = transactions.filter(t => {
        if (!t.createdAt) return false;
        const transactionDate = t.createdAt.toDate();
        return transactionDate >= targetWeekStart && transactionDate < endOfTargetWeek;
      });

      const salesData = sellers.map(seller => {
        const totalProfit = weeklyTransactions
          .filter(t => t.seller === seller.name)
          .reduce((sum, t) => sum + (parseFloat(t.netProfitCzk) || 0), 0);
        return {
          name: seller.name,
          'Čistý zisk': parseFloat(totalProfit.toFixed(2)),
        };
      });

      setChartData(salesData);

      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      const startDateString = targetWeekStart.toLocaleDateString('cs-CZ', options);
      const endDateString = new Date(endOfTargetWeek.setDate(endOfTargetWeek.getDate() - 1)).toLocaleDateString('cs-CZ', options);
      setWeekRange(`${startDateString} - ${endDateString}`);
    }, [transactions, sellers, weekOffset]);

    const handlePreviousWeek = () => setWeekOffset(prev => prev - 1);
    const handleNextWeek = () => setWeekOffset(prev => prev + 1);

    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
            <DollarSign className="mr-2 text-indigo-500" /> Graf prodejů
          </h2>
          <div className="flex justify-between items-center mb-4">
            <button onClick={handlePreviousWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-lg font-semibold">{getWeekNumber(new Date(new Date().setDate(new Date().getDate() + weekOffset * 7)))} ({weekRange})</span>
            <button onClick={handleNextWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `${value} CZK`} />
              <Legend />
              <Bar dataKey="Čistý zisk" fill="#4f46e5" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };
  
  const HistoryView = ({ history }) => {
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate();
        return `${date.toLocaleDateString('cs-CZ')} ${date.toLocaleTimeString('cs-CZ')}`;
    };

    return (
        <div className={containerClass}>
            <div className={cardClass}>
                <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
                    <HistoryIcon className="mr-2 text-indigo-500" /> Historie záznamů
                </h2>
                <div className="overflow-x-auto">
                    <table className={tableClass}>
                        <thead className={headerClass}>
                            <tr>
                                <th className={thClass}>Čas</th>
                                <th className={thClass}>Akce</th>
                                <th className={thClass}>Detaily</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {history.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate()).map(log => (
                                <tr key={log.id}>
                                    <td className={tdClass}>{formatTimestamp(log.timestamp)}</td>
                                    <td className={tdClass}>
                                        <span className={`font-bold ${log.action === 'Přidáno' ? 'text-green-600' : log.action === 'Upraveno' ? 'text-blue-600' : 'text-red-600'}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className={tdClass}>{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const SettingsView = ({ db }) => {
      const [newRate, setNewRate] = useState(PLN_TO_CZK_RATE_DEFAULT);
      const [message, setMessage] = useState('');

      const handleSaveRate = async () => {
          if (newRate <= 0) {
              setMessage('Prosím zadejte platný směnný kurz.');
              return;
          }

          try {
              const settingsRef = doc(db, `/artifacts/${__app_id}/public/data/settings`, 'exchangeRate');
              await setDoc(settingsRef, { value: parseFloat(newRate), timestamp: serverTimestamp() }, { merge: true });
              setMessage('Směnný kurz byl úspěšně uložen!');
          } catch (e) {
              console.error("Error updating exchange rate:", e);
              setMessage('Nepodařilo se uložit směnný kurz.');
          }
      };

      return (
          <div className={containerClass}>
              <div className={cardClass}>
                  <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
                      <SettingsIcon className="mr-2 text-indigo-500" /> Nastavení aplikace
                  </h2>
                  <div className="flex flex-col gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Směnný kurz PLN k CZK</label>
                          <input type="number" step="0.01" value={newRate} onChange={(e) => setNewRate(parseFloat(e.target.value) || PLN_TO_CZK_RATE_DEFAULT)} className={inputClass} />
                      </div>
                      <button onClick={handleSaveRate} className={buttonClass}>Uložit kurz</button>
                      {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
                  </div>
              </div>
          </div>
      );
  };

  const ImportView = ({ db }) => {
    const [file, setFile] = useState(null);
    const [importMessage, setImportMessage] = useState('');
    const [XLSX, setXLSX] = useState(null);

    useEffect(() => {
        const loadXLSX = async () => {
            const module = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
            setXLSX(module);
        };
        loadXLSX();
    }, []);

    const handleFileChange = (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        setFile(selectedFile);
        setImportMessage(`Soubor ${selectedFile.name} je připraven k importu.`);
      }
    };

    const handleImport = async () => {
      if (!XLSX) {
        setImportMessage('Chyba: Knihovna pro zpracování XLSX není dostupná.');
        return;
      }
      if (!file) {
        window.alert('Prosím, vyberte soubor pro import.');
        return;
      }
  
      setImportMessage('Probíhá import dat...');
  
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
          if (json.length < 2) {
            setImportMessage('Soubor neobsahuje dostatek dat.');
            return;
          }
  
          const recordsToImport = [];
          for (let i = 1; i < json.length; i++) {
            const row = json[i];
            if (!row[1] || !row[8] || !row[10] || !row[7]) continue;
            const record = {
              saleDate: row[0] && row[0] instanceof Date ? row[0].toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
              itemName: row[1] || '',
              supplier: row[12] || '',
              note: row[6] || '',
              destination: row[15] || '',
              driver: row[14] || '',
              seller: row[7] || '',
              purchasePricePln: parseFloat(row[8]) || 0,
              sellingPriceCzk: parseFloat(row[10]) || 0,
              customerName: row[16] || '',
              customerAddress: row[16] || '',
              customerContact: row[17] || '',
              netProfitCzk: parseFloat(row[11]) || 0,
              createdAt: serverTimestamp(),
            };
            recordsToImport.push(record);
          }
  
          const batchSize = 10;
          for (let i = 0; i < recordsToImport.length; i += batchSize) {
            const batch = recordsToImport.slice(i, i + batchSize);
            try {
              await Promise.all(batch.map(record => addDoc(collection(db, `/artifacts/${__app_id}/public/data/transactions`), record)));
            } catch (e) {
              console.error("Chyba při hromadném importu:", e);
              setImportMessage(`Import selhal. Chyba: ${e.message}`);
              return;
            }
          }
  
          setImportMessage(`Import dokončen. Bylo přidáno ${recordsToImport.length} záznamů.`);
          await addDoc(collection(db, `/artifacts/${__app_id}/public/data/history`), {
            action: 'Import',
            details: `Importováno ${recordsToImport.length} záznamů z XLSX souboru.`,
            timestamp: serverTimestamp(),
          });
          setFile(null);
        };
  
        reader.onerror = (e) => {
          setImportMessage('Chyba při čtení souboru.');
          console.error("FileReader error:", e);
        };
  
        reader.readAsArrayBuffer(file);
  
      } catch (e) {
        console.error("Chyba při zpracování souboru:", e);
        setImportMessage(`Import selhal. Chyba: ${e.message}`);
      }
    };

    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
            <Upload className="mr-2 text-indigo-500" /> Nahrát XLSX
          </h2>
          <p className="text-gray-600 mb-4">
            Vyberte soubor ve formátu XLSX (např. z Excelu) a importujte data.
          </p>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100"
          />
          <button onClick={handleImport} className={`${buttonClass} mt-4`}>
            Importovat
          </button>
          {importMessage && <p className="mt-4 text-sm text-green-600 font-medium">{importMessage}</p>}
        </div>
      </div>
    );
  };

  const SalesOverviewView = ({ db, transactions }) => {
    const [weekOffset, setWeekOffset] = useState(0);
    const today = new Date();
    const startOfCurrentWeek = getStartOfWeek(today);
    const targetWeekStart = new Date(startOfCurrentWeek);
    targetWeekStart.setDate(startOfCurrentWeek.getDate() + weekOffset * 7);

    const weekTransactions = transactions.filter(t => {
      if (!t.saleDate) return false;
      const transactionDate = new Date(t.saleDate);
      return transactionDate >= targetWeekStart && transactionDate < new Date(new Date(targetWeekStart).setDate(targetWeekStart.getDate() + 7));
    });

    const handlePreviousWeek = () => setWeekOffset(prev => prev - 1);
    const handleNextWeek = () => setWeekOffset(prev => prev + 1);

    const handleMoveItemToNextWeek = async (item) => {
        const itemRef = doc(db, `/artifacts/${__app_id}/public/data/transactions`, item.id);
        const saleDate = new Date(item.saleDate);
        saleDate.setDate(saleDate.getDate() + 7);
        const newSaleDate = saleDate.toISOString().slice(0, 10);

        try {
            await updateDoc(itemRef, { saleDate: newSaleDate });
            await addDoc(collection(db, `/artifacts/${__app_id}/public/data/history`), {
                action: 'Posunuto o týden',
                docId: item.id,
                details: `Položka '${item.itemName}' posunuta na týden: ${getWeekNumber(saleDate)}.`,
                timestamp: serverTimestamp(),
            });
        } catch (e) {
            console.error("Error moving item to next week: ", e);
        }
    };
    
    const weekNumber = getWeekNumber(targetWeekStart);

    return (
        <div className={containerClass}>
             <div className={cardClass}>
                <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
                    <DollarSign className="mr-2 text-indigo-500" /> Přehled prodejů
                </h2>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={handlePreviousWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
                        <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <span className="text-lg font-semibold">{weekNumber} ({getWeekRange(targetWeekStart)})</span>
                    <button onClick={handleNextWeek} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className={tableClass}>
                        <thead className={headerClass}>
                            <tr>
                                <th className={thClass}>Položka</th>
                                <th className={thClass}>Značka</th>
                                <th className={thClass}>Model</th>
                                <th className={thClass}>Prodej (CZK)</th>
                                <th className={thClass}>Zisk</th>
                                <th className={thClass}>Datum prodeje</th>
                                <th className={thClass}>Prodejce</th>
                                <th className={thClass}>Akce</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {weekTransactions.sort((a, b) => b.saleDate < a.saleDate ? 1 : -1).map(item => (
                                <tr key={item.id}>
                                    <td className={tdClass}>{item.itemName}</td>
                                    <td className={tdClass}>{item.brand || '-'}</td>
                                    <td className={tdClass}>{item.model || '-'}</td>
                                    <td className={tdClass}>{item.sellingPriceCzk}</td>
                                    <td className={tdClass}>
                                        <span className={`font-bold ${item.netProfitCzk > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.netProfitCzk} CZK
                                        </span>
                                    </td>
                                    <td className={tdClass}>{item.saleDate}</td>
                                    <td className={tdClass}>{item.seller}</td>
                                    <td className={tdClass}>
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleMoveItemToNextWeek(item)} className="text-blue-600 hover:text-blue-900" aria-label="Move to next week">
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-16">
            <div className="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-bold text-indigo-600">Business Manager</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button onClick={() => setCurrentView(Views.TRANSACTIONS)} className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === Views.TRANSACTIONS ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}>
                <DollarSign className="h-5 w-5 mr-1" />
                Transakce
              </button>
              <button onClick={() => setCurrentView(Views.OLD_ENGINES)}
                className={`px-3 py-2 rounded-xl transition-colors duration-200 ${currentView === Views.OLD_ENGINES ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/20' : 'text-zinc-700 hover:bg-zinc-100 ring-1 ring-transparent dark:text-zinc-200 dark:hover:bg-zinc-800'}`}>
                Staré motory
              </button>
              <button onClick={() => setCurrentView(Views.PERSONNEL)} className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === Views.PERSONNEL ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}>
                <Briefcase className="h-5 w-5 mr-1" />
                Personál
              </button>
              <button onClick={() => setCurrentView(Views.DELIVERY_FILTER)} className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === Views.DELIVERY_FILTER ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}>
                <Truck className="h-5 w-5 mr-1" />
                Rozvozy
              </button>
              <button onClick={() => setCurrentView(Views.SALES_GRAPH)} className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === Views.SALES_GRAPH ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}>
                <DollarSign className="h-5 w-5 mr-1" />
                Grafy
              </button>
              <button onClick={() => setCurrentView(Views.HISTORY)} className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === Views.HISTORY ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}>
                <HistoryIcon className="h-5 w-5 mr-1" />
                Historie
              </button>
              <button onClick={() => setCurrentView(Views.IMPORT)} className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === Views.IMPORT ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}>
                <Upload className="h-5 w-5 mr-1" />
                Import
              </button>
              <button onClick={() => setCurrentView(Views.SETTINGS)} className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentView === Views.SETTINGS ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-800 hover:bg-gray-200'}`}>
                <SettingsIcon className="h-5 w-5 mr-1" />
                Nastavení
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8">
        {currentView === Views.TRANSACTIONS && <TransactionsView sellers={sellers} drivers={drivers} db={db} transactions={transactions} />}
        {currentView === Views.PERSONNEL && <PersonnelView sellers={sellers} drivers={drivers} db={db} />}
        {currentView === Views.DELIVERY_FILTER && <DeliveryFilterView transactions={transactions} drivers={drivers} />}
        {currentView === Views.SALES_GRAPH && <SalesGraphView transactions={transactions} sellers={sellers} />}
        {currentView === Views.HISTORY && <HistoryView history={history} />}
        {currentView === Views.IMPORT && <ImportView db={db} />}
        {currentView === Views.SALES_OVERVIEW && <SalesOverviewView db={db} transactions={transactions} />}
        {currentView === Views.SETTINGS && <SettingsView db={db} />}
      </main>
    </div>
  );
};


// Staré motory – prázdná sekce pro generálkované motory (zákazník vrací starý kus)
const OldEnginesView = () => {
  const tableClass = "min-w-full divide-y divide-zinc-200 dark:divide-zinc-700";
  const headerClass = "bg-zinc-50 dark:bg-zinc-900";
  const thClass = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-100";

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Staré motory</h2>
        <span className="text-sm text-zinc-500">Zatím není žádná položka</span>
      </div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead className={headerClass}>
            <tr>
              <th className={thClass}>Položka</th>
              <th className={thClass}>Značka</th>
              <th className={thClass}>Model</th>
              <th className={thClass}>Nákup (PLN)</th>
              <th className={thClass}>Prodej (Kč)</th>
              <th className={thClass}>Město</th>
              <th className={thClass}>Zákazník</th>
              <th className={thClass}>Adresa</th>
              <th className={thClass}>Kontakt</th>
              <th className={thClass}>Poznámka</th>
              <th className={thClass}>Záloha</th>
              <th className={thClass}>Vráceno</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tdClass} colSpan={12}>
                <div className="text-center text-zinc-500 dark:text-zinc-400 py-6">
                  Zatím žádná data. Přidáme později dle tvých instrukcí.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};



export default App;
