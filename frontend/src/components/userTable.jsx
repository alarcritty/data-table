'use client';
import React from "react";
import { deleteUser } from "../services/api";

export default function UserTable({
  users = [],
  setActiveUserId,
  getUsers,
  sortBy,
  order,
  setSortBy,
  setOrder,
}) {
  const handleDelete = async (id) => {
    try {
      await deleteUser(id);
      getUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setOrder("asc");
    }
  };

  const renderSortIcon = (column) => {
    if (sortBy !== column) return null;
    return order === "asc" ? (
      <span className="ml-1 text-xs">&#9650;</span>
    ) : (
      <span className="ml-1 text-xs">&#9660;</span>
    );
  };

  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full border border-gray-300 bg-white rounded-lg shadow-sm">
        <thead className="sticky top-0 bg-gray-100 z-10">
          <tr className="border-b">
            {["id", "firstName", "lastName", "email", "phone", "age", "driverLicense"].map((col) => (
              <th
                key={col}
                className="px-4 py-2 text-left cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort(col)}
              >
                {col === "id" ? "User ID" : col.charAt(0).toUpperCase() + col.slice(1)} {renderSortIcon(col)}
              </th>
            ))}
            <th className="px-4 py-2 text-left whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan="8" className="p-4 text-center text-gray-500">
                No users found
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user._id ?? user.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {user.id}
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{user.firstName}</td>
                <td className="px-4 py-2 whitespace-nowrap">{user.lastName}</td>
                <td className="px-4 py-2 whitespace-nowrap">{user.email}</td>
                <td className="px-4 py-2 whitespace-nowrap">{user.phone}</td>
                <td className="px-4 py-2 whitespace-nowrap">{user.age ?? "N/A"}</td>
                <td className="px-4 py-2 whitespace-nowrap">{user.driverLicense ?? "N/A"}</td>
                <td className="px-4 py-2 whitespace-nowrap flex gap-2">
                  <button
                    onClick={() => handleDelete(user._id ?? user.id)}
                    className="bg-red-500 text-white py-1 px-3 rounded hover:bg-red-600 transition-colors duration-150"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setActiveUserId(user._id ?? user.id)}
                    className="bg-indigo-500 text-white py-1 px-3 rounded hover:bg-indigo-600 transition-colors duration-150"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
