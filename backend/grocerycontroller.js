const db = require('./db');

const getAllItems = async (req, res) => {
    try {
        const { search, category, inStock } = req.query;

        let query = 'SELECT * FROM groceries WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND name LIKE ?';
            params.push(`%${search}%`);
        }

        if (category && category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }

        if (inStock !== undefined && inStock !== 'all') {
            query += ' AND in_stock = ?';
            params.push(inStock === 'true' ? 1 : 0);
        }

        query += ' ORDER BY id DESC';

        const [rows] = await db.execute(query, params);

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching items:', error.message);
        res.status(500).json({ success: false, message: 'Server error while fetching items' });
    }
};

const getItemById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT * FROM groceries WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error fetching item:', error.message);
        res.status(500).json({ success: false, message: 'Server error while fetching item' });
    }
};

const addItem = async (req, res) => {
    try {
        const { name, category, quantity, unit, price, expiry_date, low_stock_threshold, in_stock } = req.body;

        if (!name || !category || quantity === undefined || !unit || price === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Required fields: name, category, quantity, unit, price'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO groceries
      (name, category, quantity, unit, price, expiry_date, low_stock_threshold, in_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name.trim(),
                category.trim(),
                parseInt(quantity),
                unit.trim(),
                parseFloat(price),
                expiry_date || null,
                parseInt(low_stock_threshold) || 5,
                in_stock !== undefined ? in_stock : true
            ]
        );

        const [newItem] = await db.execute('SELECT * FROM groceries WHERE id = ?', [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Grocery item added successfully!',
            data: newItem[0]
        });
    } catch (error) {
        console.error('Error adding item:', error.message);
        res.status(500).json({ success: false, message: 'Server error while adding item' });
    }
};

const updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, quantity, unit, price, expiry_date, low_stock_threshold, in_stock } = req.body;

        const [existing] = await db.execute('SELECT * FROM groceries WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        await db.execute(
            `UPDATE groceries SET
      name = ?, category = ?, quantity = ?, unit = ?,
      price = ?, expiry_date = ?, low_stock_threshold = ?, in_stock = ?
      WHERE id = ?`,
            [
                name.trim(),
                category.trim(),
                parseInt(quantity),
                unit.trim(),
                parseFloat(price),
                expiry_date || null,
                parseInt(low_stock_threshold) || 5,
                in_stock !== undefined ? in_stock : true,
                id
            ]
        );

        const [updated] = await db.execute('SELECT * FROM groceries WHERE id = ?', [id]);

        res.status(200).json({
            success: true,
            message: 'Item updated successfully!',
            data: updated[0]
        });
    } catch (error) {
        console.error('Error updating item:', error.message);
        res.status(500).json({ success: false, message: 'Server error while updating item' });
    }
};

const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.execute('SELECT * FROM groceries WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        await db.execute('DELETE FROM groceries WHERE id = ?', [id]);

        res.status(200).json({
            success: true,
            message: `Item "${existing[0].name}" deleted successfully!`
        });
    } catch (error) {
        console.error('Error deleting item:', error.message);
        res.status(500).json({ success: false, message: 'Server error while deleting item' });
    }
};

const getStats = async (req, res) => {
    try {
        const [[{ total }]] = await db.execute('SELECT COUNT(*) as total FROM groceries');

        const [[{ inStock }]] = await db.execute(
            'SELECT COUNT(*) as inStock FROM groceries WHERE in_stock = TRUE'
        );

        const [[{ outOfStock }]] = await db.execute(
            'SELECT COUNT(*) as outOfStock FROM groceries WHERE in_stock = FALSE'
        );

        const [[{ lowStock }]] = await db.execute(
            'SELECT COUNT(*) as lowStock FROM groceries WHERE quantity > 0 AND quantity <= low_stock_threshold AND in_stock = TRUE'
        );

        const [[{ totalValue }]] = await db.execute(
            'SELECT SUM(price * quantity) as totalValue FROM groceries'
        );

        const [categories] = await db.execute(
            'SELECT DISTINCT category FROM groceries ORDER BY category'
        );

        res.status(200).json({
            success: true,
            data: {
                total: total || 0,
                inStock: inStock || 0,
                outOfStock: outOfStock || 0,
                lowStock: lowStock || 0,
                totalValue: parseFloat(totalValue || 0).toFixed(2),
                categories: categories.map(c => c.category)
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error.message);
        res.status(500).json({ success: false, message: 'Server error while fetching stats' });
    }
};

module.exports = { getAllItems, getItemById, addItem, updateItem, deleteItem, getStats };