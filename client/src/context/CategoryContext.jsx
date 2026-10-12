import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './personal_expense/AuthContext';
import { API_URL } from '../config';

const CategoryContext = createContext();

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export const CategoryProvider = ({ children }) => {
    const { user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/server/categories`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            } else {
                console.error('Failed to fetch categories', res.status);
            }
        } catch (err) {
            console.error("Failed to fetch categories", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchCategories();
        }
    }, [user]);

    const addCategory = async (categoryOrName, type = 'expense', color = '#94a3b8') => {
        try {
            const payload = (typeof categoryOrName === 'object' && categoryOrName !== null)
                ? categoryOrName
                : { name: categoryOrName, type, color };

            const res = await fetch(`${API_URL}/server/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error('Failed to add category', res.status, errData);
                return { success: false, error: errData.error || `Error ${res.status}` };
            }
            const created = await res.json();
            await fetchCategories();
            return { success: true, category: created };
        } catch (err) {
            console.error('Failed to add category', err);
            return { success: false, error: err.message };
        }
    };

    const updateCategory = async (id, data) => {
        try {
            // Check if rename
            if (data.name) {
                const res = await fetch(`${API_URL}/server/categories/rename/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ newName: data.name })
                });
                if (!res.ok) console.error('Failed to rename category', res.status);
            }

            // Check if other props update
            if (data.color || data.type) {
                const res = await fetch(`${API_URL}/server/categories/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ color: data.color, type: data.type })
                });
                if (!res.ok) console.error('Failed to update category', res.status);
            }
        } catch (err) {
            console.error('Failed to update category', err);
        }

        fetchCategories();
    };

    const deleteCategory = async (id) => {
        try {
            const res = await fetch(`${API_URL}/server/categories/${id}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) console.error('Failed to delete category', res.status);
        } catch (err) {
            console.error('Failed to delete category', err);
        }
        fetchCategories();
    };

    return (
        <CategoryContext.Provider value={{ categories, loading, addCategory, updateCategory, deleteCategory, refreshCategories: fetchCategories }}>
            {children}
        </CategoryContext.Provider>
    );
};

export const useCategories = () => useContext(CategoryContext);
