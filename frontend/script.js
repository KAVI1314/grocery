// ============================================
// FILE: frontend/script.js
// PURPOSE: All frontend logic — API calls, UI rendering,
//          search/filter, form handling, modals, toasts
// ============================================

// ─── CONFIGURATION ────────────────────────────
// Change this if your backend runs on a different port
const API_BASE_URL = 'http://localhost:5000/api';

// ─── STATE ────────────────────────────────────
let allItems = [];        // All fetched grocery items
let deleteItemId = null;  // ID of item pending deletion
let currentView = 'table'; // 'table' or 'card'
let debounceTimer = null;  // For search debounce

// ═══════════════════════════════════════════════
//  INITIALIZATION — runs when page loads
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  fetchStats();
  fetchAllItems();
});

// ═══════════════════════════════════════════════
//  API FUNCTIONS — all HTTP calls to backend
// ═══════════════════════════════════════════════

/**
 * Fetch dashboard statistics (total, in stock, low stock, etc.)
 */
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/groceries/stats`);
    const data = await res.json();

    if (data.success) {
      const s = data.data;
      document.getElementById('stat-total').textContent = s.total;
      document.getElementById('stat-instock').textContent = s.inStock;
      document.getElementById('stat-lowstock').textContent = s.lowStock;
      document.getElementById('stat-outofstock').textContent = s.outOfStock;
      document.getElementById('stat-value').textContent = `₹${Number(s.totalValue).toLocaleString('en-IN')}`;

      // Populate category filter dropdown
      populateCategoryFilter(s.categories);

      // Show low stock banner if needed
      if (s.lowStock > 0) {
        const banner = document.getElementById('lowStockBanner');
        document.getElementById('lowStockMessage').textContent =
          `⚠️ ${s.lowStock} item${s.lowStock > 1 ? 's are' : ' is'} running low on stock!`;
        banner.style.display = 'flex';
      } else {
        document.getElementById('lowStockBanner').style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
}

/**
 * Fetch all grocery items (with optional search/filter params)
 */
async function fetchAllItems(params = {}) {
  showLoading(true);

  try {
    // Build query string from params object
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/groceries${queryString ? '?' + queryString : ''}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      allItems = data.data;
      renderItems(allItems);

      // Update result count
      document.getElementById('resultCount').textContent =
        `Showing ${allItems.length} item${allItems.length !== 1 ? 's' : ''}`;
    } else {
      showToast('Failed to load items', 'error');
    }
  } catch (error) {
    console.error('Fetch error:', error);
    showToast('Cannot connect to server. Is it running?', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Add a new grocery item via POST request
 */
async function addItem(formData) {
  const res = await fetch(`${API_BASE_URL}/groceries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data;
}

/**
 * Update an existing grocery item via PUT request
 */
async function updateItem(id, formData) {
  const res = await fetch(`${API_BASE_URL}/groceries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data;
}

/**
 * Delete a grocery item via DELETE request
 */
async function deleteItem(id) {
  const res = await fetch(`${API_BASE_URL}/groceries/${id}`, {
    method: 'DELETE'
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data;
}

// ═══════════════════════════════════════════════
//  RENDER FUNCTIONS — build HTML from data
// ═══════════════════════════════════════════════

/**
 * Renders items in both table and card views
 */
function renderItems(items) {
  if (items.length === 0) {
    document.getElementById('tableView').style.display = 'none';
    document.getElementById('cardView').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  renderTable(items);
  renderCards(items);

  // Show correct view
  switchView(currentView);
}

/**
 * Render the TABLE view
 */
function renderTable(items) {
  const tbody = document.getElementById('groceryTableBody');
  tbody.innerHTML = items.map((item, index) => {
    const rowClass = getRowClass(item);
    const statusBadge = getStatusBadge(item);
    const expiryText = formatExpiry(item.expiry_date);

    return `
      <tr class="${rowClass}">
        <td style="color: var(--text-muted); font-size: 0.8rem;">${index + 1}</td>
        <td>
          <div class="item-name">${escapeHtml(item.name)}</div>
        </td>
        <td><span class="category-badge">${escapeHtml(item.category)}</span></td>
        <td>
          <span class="item-qty" style="color: ${getQtyColor(item)}">
            ${item.quantity} ${escapeHtml(item.unit)}
          </span>
        </td>
        <td class="item-price">₹${Number(item.price).toFixed(2)}</td>
        <td>${expiryText}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn edit" onclick="openEditModal(${item.id})" title="Edit">
              <i class='bx bx-edit'></i>
            </button>
            <button class="action-btn delete" onclick="openDeleteModal(${item.id}, '${escapeHtml(item.name)}')" title="Delete">
              <i class='bx bx-trash'></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render the CARD view
 */
function renderCards(items) {
  const grid = document.getElementById('groceryCardsGrid');
  grid.innerHTML = items.map(item => {
    const cardClass = getCardClass(item);
    const statusBadge = getStatusBadge(item);

    return `
      <div class="grocery-card ${cardClass}">
        <div class="card-header">
          <span class="card-name">${escapeHtml(item.name)}</span>
          ${statusBadge}
        </div>
        <div class="card-meta">
          <span class="category-badge">${escapeHtml(item.category)}</span>
          &nbsp; ${formatExpiry(item.expiry_date)}
        </div>
        <div class="card-price">₹${Number(item.price).toFixed(2)}
          <span class="card-qty">per ${escapeHtml(item.unit)}</span>
        </div>
        <div class="card-footer">
          <span style="font-size: 0.85rem; color: ${getQtyColor(item)}; font-weight: 600;">
            Stock: ${item.quantity} ${escapeHtml(item.unit)}
          </span>
          <div class="action-btns">
            <button class="action-btn edit" onclick="openEditModal(${item.id})" title="Edit">
              <i class='bx bx-edit'></i>
            </button>
            <button class="action-btn delete" onclick="openDeleteModal(${item.id}, '${escapeHtml(item.name)}')" title="Delete">
              <i class='bx bx-trash'></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── HELPER FUNCTIONS FOR RENDERING ──────────

function getRowClass(item) {
  if (!item.in_stock) return 'out-stock-row';
  if (item.quantity > 0 && item.quantity <= item.low_stock_threshold) return 'low-stock-row';
  return '';
}

function getCardClass(item) {
  if (!item.in_stock) return 'out-stock-card';
  if (item.quantity > 0 && item.quantity <= item.low_stock_threshold) return 'low-stock-card';
  return '';
}

function getStatusBadge(item) {
  if (!item.in_stock) {
    return `<span class="badge badge-danger"><i class='bx bx-x'></i> Out of Stock</span>`;
  }
  if (item.quantity > 0 && item.quantity <= item.low_stock_threshold) {
    return `<span class="badge badge-warning"><i class='bx bx-error'></i> Low Stock</span>`;
  }
  return `<span class="badge badge-success"><i class='bx bx-check'></i> In Stock</span>`;
}

function getQtyColor(item) {
  if (!item.in_stock) return 'var(--danger)';
  if (item.quantity <= item.low_stock_threshold) return 'var(--warning)';
  return 'var(--success)';
}

function formatExpiry(dateStr) {
  if (!dateStr) return '<span style="color: var(--text-muted);">—</span>';

  const expiry = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  const formatted = expiry.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  if (diffDays < 0) {
    return `<span class="expiry-warning" title="Expired!">⚠️ ${formatted}</span>`;
  } else if (diffDays <= 7) {
    return `<span class="expiry-soon" title="Expires soon">🔔 ${formatted}</span>`;
  }
  return `<span>${formatted}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════
//  SEARCH & FILTER
// ═══════════════════════════════════════════════

function handleSearch() {
  // Debounce to avoid firing on every keystroke
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const search = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categoryFilter').value;
    const inStock = document.getElementById('stockFilter').value;

    const params = {};
    if (search) params.search = search;
    if (category !== 'all') params.category = category;
    if (inStock !== 'all') params.inStock = inStock;

    fetchAllItems(params);
  }, 300); // 300ms debounce
}

function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('categoryFilter').value = 'all';
  document.getElementById('stockFilter').value = 'all';
  fetchAllItems();
}

function populateCategoryFilter(categories) {
  const select = document.getElementById('categoryFilter');
  const current = select.value;

  // Keep the "All" option, rebuild the rest
  select.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  select.value = current; // Preserve selection
}

// ═══════════════════════════════════════════════
//  VIEW TOGGLE (Table / Card)
// ═══════════════════════════════════════════════

function switchView(view) {
  currentView = view;
  const tableView = document.getElementById('tableView');
  const cardView = document.getElementById('cardView');
  const tableBtn = document.getElementById('tableViewBtn');
  const cardBtn = document.getElementById('cardViewBtn');

  if (view === 'table') {
    tableView.style.display = 'block';
    cardView.style.display = 'none';
    tableBtn.classList.add('active');
    cardBtn.classList.remove('active');
  } else {
    tableView.style.display = 'none';
    cardView.style.display = 'block';
    cardBtn.classList.add('active');
    tableBtn.classList.remove('active');
  }
}

// ═══════════════════════════════════════════════
//  MODAL — ADD ITEM
// ═══════════════════════════════════════════════

function openModal() {
  document.getElementById('modalTitle').textContent = 'Add Grocery Item';
  document.getElementById('submitBtnText').textContent = 'Add Item';
  document.getElementById('itemId').value = '';
  document.getElementById('groceryForm').reset();
  document.getElementById('itemInStock').checked = true;
  clearFormErrors();

  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('itemName').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// Close modal if clicking on the dark overlay background
function handleOverlayClick(event) {
  if (event.target === document.getElementById('modalOverlay')) {
    closeModal();
  }
}

// ═══════════════════════════════════════════════
//  MODAL — EDIT ITEM
// ═══════════════════════════════════════════════

async function openEditModal(id) {
  try {
    // Fetch the latest data for this item from the server
    const res = await fetch(`${API_BASE_URL}/groceries/${id}`);
    const data = await res.json();

    if (!data.success) {
      showToast('Failed to load item data', 'error');
      return;
    }

    const item = data.data;

    // Populate form with existing values
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemUnit').value = item.unit;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemThreshold').value = item.low_stock_threshold;
    document.getElementById('itemInStock').checked = item.in_stock === 1 || item.in_stock === true;

    // Format expiry date for input (must be YYYY-MM-DD)
    if (item.expiry_date) {
      document.getElementById('itemExpiry').value = item.expiry_date.split('T')[0];
    } else {
      document.getElementById('itemExpiry').value = '';
    }

    // Update modal title
    document.getElementById('modalTitle').textContent = 'Edit Grocery Item';
    document.getElementById('submitBtnText').textContent = 'Save Changes';
    clearFormErrors();

    document.getElementById('modalOverlay').classList.add('active');
  } catch (error) {
    showToast('Error loading item', 'error');
  }
}

// ═══════════════════════════════════════════════
//  FORM SUBMISSION (Add or Edit)
// ═══════════════════════════════════════════════

async function handleFormSubmit(event) {
  event.preventDefault(); // Prevent default form submission

  // Validate form
  if (!validateForm()) return;

  const itemId = document.getElementById('itemId').value;
  const isEdit = !!itemId; // true if editing, false if adding

  // Collect form data
  const formData = {
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value,
    quantity: parseInt(document.getElementById('itemQuantity').value),
    unit: document.getElementById('itemUnit').value,
    price: parseFloat(document.getElementById('itemPrice').value),
    low_stock_threshold: parseInt(document.getElementById('itemThreshold').value) || 5,
    expiry_date: document.getElementById('itemExpiry').value || null,
    in_stock: document.getElementById('itemInStock').checked
  };

  // Update submit button state
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Saving...`;

  try {
    if (isEdit) {
      await updateItem(itemId, formData);
      showToast(`"${formData.name}" updated successfully!`, 'success');
    } else {
      await addItem(formData);
      showToast(`"${formData.name}" added successfully!`, 'success');
    }

    closeModal();
    fetchAllItems(); // Refresh the list
    fetchStats();    // Refresh dashboard stats

  } catch (error) {
    showToast(error.message || 'Something went wrong', 'error');
  } finally {
    // Reset button
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class='bx bx-save'></i> <span id="submitBtnText">${isEdit ? 'Save Changes' : 'Add Item'}</span>`;
  }
}

// ═══════════════════════════════════════════════
//  FORM VALIDATION
// ═══════════════════════════════════════════════

function validateForm() {
  clearFormErrors();
  let isValid = true;

  const name = document.getElementById('itemName').value.trim();
  if (!name || name.length < 2) {
    showFieldError('nameError', 'Name must be at least 2 characters');
    isValid = false;
  }

  const quantity = document.getElementById('itemQuantity').value;
  if (quantity === '' || isNaN(quantity) || parseInt(quantity) < 0) {
    showToast('Quantity must be a non-negative number', 'error');
    isValid = false;
  }

  const price = document.getElementById('itemPrice').value;
  if (price === '' || isNaN(price) || parseFloat(price) < 0) {
    showToast('Price must be a non-negative number', 'error');
    isValid = false;
  }

  return isValid;
}

function showFieldError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = message;
}

function clearFormErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

// ═══════════════════════════════════════════════
//  DELETE MODAL
// ═══════════════════════════════════════════════

function openDeleteModal(id, name) {
  deleteItemId = id;
  document.getElementById('deleteItemName').textContent = name;
  document.getElementById('deleteModalOverlay').classList.add('active');
}

function closeDeleteModal() {
  deleteItemId = null;
  document.getElementById('deleteModalOverlay').classList.remove('active');
}

async function confirmDelete() {
  if (!deleteItemId) return;

  try {
    const data = await deleteItem(deleteItemId);
    showToast(data.message || 'Item deleted!', 'success');
    closeDeleteModal();
    fetchAllItems();
    fetchStats();
  } catch (error) {
    showToast('Failed to delete item', 'error');
    closeDeleteModal();
  }
}

// ═══════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════

let toastTimer = null;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  // Set content
  toastMsg.textContent = message;

  // Set icon based on type
  const icons = {
    success: 'bx-check-circle',
    error: 'bx-x-circle',
    warning: 'bx-error'
  };

  toastIcon.className = `bx ${icons[type] || icons.success} toast-icon`;

  // Set styling
  toast.className = `toast ${type} show`;

  // Auto-hide after 3.5 seconds
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ═══════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════

function showLoading(visible) {
  document.getElementById('loadingSpinner').style.display = visible ? 'flex' : 'none';
  if (visible) {
    document.getElementById('tableView').style.display = 'none';
    document.getElementById('cardView').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
  }
}

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteModal();
  }
});
