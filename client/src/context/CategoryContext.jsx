import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './personal_expense/AuthContext';
import { API_URL } from '../config';

const CategoryContext = createContext();

export const CategoryProvider = ({ children }) => {
    const { user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/server/categories`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
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

    const addCategory = async (category) => {
        await fetch(`${API_URL}/server/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category)
        });
        fetchCategories();
    };

    const updateCategory = async (id, data) => {
        // Check if rename
        if (data.name) {
            await fetch(`${API_URL}/server/categories/rename/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName: data.name })
            });
        }

        // Check if other props update
        if (data.color || data.type) {
            await fetch(`${API_URL}/server/categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ color: data.color, type: data.type })
            });
        }

        fetchCategories();
    };

    const deleteCategory = async (id) => {
        await fetch(`${API_URL}/server/categories/${id}`, { method: 'DELETE' });
        fetchCategories();
    };

    return (
        <CategoryContext.Provider value={{ categories, loading, addCategory, updateCategory, deleteCategory, refreshCategories: fetchCategories }}>
            {children}
        </CategoryContext.Provider>
    );
};

export const useCategories = () => useContext(CategoryContext);
