"use client";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRequest, postRequest, deleteRequest } from "@/lib/fetcher";
import { toast } from "react-toastify";
import { Loader2, Edit2, Trash2, MapPin, Plus, X } from "lucide-react";

interface Address {
  address_id: number;
  user_id: number;
  name: string;
  phone: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  address_type: string;
  created_at: string;
}

export default function AddressManager() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);

  const defaultForm = {
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  };
  const [formData, setFormData] = useState(defaultForm);

  const { data: profileData, isLoading: loadingAddresses } = useQuery({
    queryKey: ["userProfile"],
    queryFn: () => getRequest<any>("/api/v1/users/profile"),
  });

  const addresses: Address[] = profileData?.data?.user_address || [];

  const { mutateAsync: saveAddress, isPending: savingAddress } = useMutation({
    mutationFn: (data: any) =>
      postRequest({ url: "/api/v1/users/my-address", body: data }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success(res?.message || "Address saved successfully");
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save address");
    },
  });

  const { mutateAsync: removeAddress, isPending: deletingAddressId } = useMutation({
    mutationFn: (address_id: number) =>
      deleteRequest({ url: "/api/v1/users/my-address", body: { address_id } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success(res?.message || "Address removed successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to remove address");
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formData };
    if (editingAddressId) {
      payload.address_id = editingAddressId;
    }
    await saveAddress(payload);
  };

  const openModal = (address?: Address) => {
    if (address) {
      setEditingAddressId(address.address_id);
      setFormData({
        fullName: address.name || "",
        email: address.email || "",
        phone: address.phone || "",
        address: address.address_line1 || "",
        city: address.city || "",
        state: address.state || "",
        pincode: address.pincode || "",
        country: "India",
      });
    } else {
      setEditingAddressId(null);
      setFormData(defaultForm);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAddressId(null);
    setFormData(defaultForm);
  };

  return (
    <div className="bg-white border border-gray-200 rounded p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Addresses</h2>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#02F8C5] text-black font-medium transition shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {loadingAddresses ? (
          <div className="col-span-full flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : addresses.length > 0 ? (
          addresses.map((address) => (
            <div
              key={address.address_id}
              className="border border-gray-200 rounded p-5 bg-white flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="font-semibold text-gray-900 text-lg">
                    {address.name}
                  </span>
                </div>
                <div className="text-gray-600 text-sm space-y-1 ml-7">
                  <p>{address.address_line1}</p>
                  <p>
                    {address.city}, {address.state} - {address.pincode}
                  </p>
                  <p>Phone: {address.phone}</p>
                  <p>Email: {address.email}</p>
                </div>
              </div>
              <div className="mt-5 ml-7 flex items-center gap-4 border-t border-gray-100 pt-3">
                <button
                  onClick={() => openModal(address)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => removeAddress(address.address_id)}
                  // disabled={deletingAddressId?.isPending}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="col-span-full text-center text-gray-500 py-10">
            You don't have any saved addresses.
          </p>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingAddressId ? "Edit Address" : "Add New Address"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-500 text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-500 text-sm text-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-500 text-sm text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Address *
                </label>
                <input
                  type="text"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Street, Flat, Area"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-500 text-sm text-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-500 text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    name="state"
                    required
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-500 text-sm text-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    required
                    value={formData.pincode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-500 text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    disabled
                    value={formData.country}
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded text-sm text-gray-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="flex items-center gap-2 px-6 py-2 bg-[#02F8C5] text-black text-sm font-medium rounded hover:bg-[#02e0b1] transition"
                >
                  {savingAddress && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingAddressId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
