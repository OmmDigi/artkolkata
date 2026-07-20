"use client";

import { CircleCheckBig, CircleX, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

interface PaymentProcessingDialogProps {
  isOpen: boolean;
  status: 'processing' | 'success' | 'failed' | 'verifying';
  onClose?: () => void;
  paymentId?: string;
  amount?: string;
  merchantName?: string;
}

export const PaymentProcessingDialog: React.FC<PaymentProcessingDialogProps> = ({
  isOpen,
  status,
  onClose,
  paymentId,
  amount,
  merchantName = "Your Store"
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (status === 'processing' || status === 'verifying') {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  if (!isOpen) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'processing':
        return {
          icon: <LoaderCircle className="w-16 h-16 text-blue-500 animate-spin" />,
          title: 'Processing Payment',
          message: `Your payment is being processed${dots}`,
          subMessage: 'Please do not close this page or press the back button.',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'verifying':
        return {
          icon: <LoaderCircle className="w-16 h-16 text-orange-500 animate-spin" />,
          title: 'Verifying Payment',
          message: `Payment verification in progress${dots}`,
          subMessage: 'Please wait while we confirm your payment details.',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      case 'success':
        return {
          icon: <CircleCheckBig className="w-16 h-16 text-green-500" />,
          title: 'Payment Successful',
          message: 'Your payment has been processed successfully!',
          subMessage: 'You will receive a confirmation email shortly.',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'failed':
        return {
          icon: <CircleX className="w-16 h-16 text-red-500" />,
          title: 'Payment Failed',
          message: 'Your payment could not be processed.',
          subMessage: 'Please try again or contact support if the issue persists.',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: <ShieldAlert className="w-16 h-16 text-gray-500" />,
          title: 'Processing',
          message: 'Please wait...',
          subMessage: '',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();
  const canClose = status === 'success' || status === 'failed';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`${config.bgColor} ${config.borderColor} border-b px-6 py-4`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{merchantName}</h3>
              <p className="text-sm text-gray-600">Secure Payment</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8 text-center">
          <div className="flex justify-center mb-6">
            {config.icon}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {config.title}
          </h2>
          
          <p className="text-lg text-gray-700 mb-2">
            {config.message}
          </p>
          
          <p className="text-sm text-gray-500 mb-6">
            {config.subMessage}
          </p>

          {/* Payment Details */}
          {(amount || paymentId) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              {amount && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900"><span className="font-sans">₹</span>{amount}</span>
                </div>
              )}
              {paymentId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Payment ID:</span>
                  <span className="font-mono text-xs text-gray-700">{paymentId}</span>
                </div>
              )}
            </div>
          )}

          {/* Security Notice */}
          {(status === 'processing' || status === 'verifying') && (
            <div className="flex items-start space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left">
              <ShieldAlert className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-800">
                <p className="font-medium mb-1">Important:</p>
                <p>Do not refresh or close this page until the process is complete. This may take up to 2 minutes.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {canClose && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <button
              onClick={onClose}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                status === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {status === 'success' ? 'Continue' : 'Try Again'}
            </button>
          </div>
        )}

        {/* Loading Animation for Processing States */}
        {(status === 'processing' || status === 'verifying') && (
          <div className="px-6 pb-4">
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
