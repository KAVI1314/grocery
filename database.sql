-- Create database
CREATE DATABASE grocery_db;

-- Use database
USE grocery_db;

-- Create table
CREATE TABLE groceries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price FLOAT NOT NULL,
  quantity INT NOT NULL,
  stock_status VARCHAR(50)
);

-- Insert sample data
INSERT INTO groceries (name, category, price, quantity, stock_status) VALUES
('Rice', 'Grains', 50, 10, 'In Stock'),
('Milk', 'Dairy', 30, 5, 'Low Stock'),
('Eggs', 'Poultry', 6, 0, 'Out of Stock');