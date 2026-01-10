import { useEffect, useState } from 'react';
import { supabase, Database } from '../../lib/supabase';
import { MessageSquare, Clock, CheckCircle, XCircle, Send } from 'lucide-react';

type ChefRequest = Database['public']['Tables']['chef_requests']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type CustomerProfile = Database['public']['Tables']['customer_profiles']['Row'];

interface ChefRequestWithDetails extends ChefRequest {
  menu_item: MenuItem;
  customer_profile: CustomerProfile;
}

interface ChefRequestsProps {
  restaurantId: string;
}

export default function ChefRequests({ restaurantId }: ChefRequestsProps) {
  const [requests, setRequests] = useState<ChefRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ChefRequestWithDetails | null>(
    null
  );
  const [response, setResponse] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [restaurantId]);

  const loadRequests = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('chef_requests')
      .select('*, menu_item:menu_items(*), customer_profile:customer_profiles(*)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data as ChefRequestWithDetails[]);
    }

    setLoading(false);
  };

  const handleRespond = async (requestId: string, status: 'approved' | 'declined') => {
    if (!response.trim() && status === 'declined') {
      alert('Please provide a reason for declining the request.');
      return;
    }

    setResponding(true);

    const { error } = await supabase
      .from('chef_requests')
      .update({
        status,
        chef_response: response.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      setSelectedRequest(null);
      setResponse('');
      loadRequests();
    }

    setResponding(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'declined':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
            <XCircle className="w-3 h-3" />
            Declined
          </span>
        );
      default:
        return null;
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const respondedRequests = requests.filter((r) => r.status !== 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Chef Requests</h2>
        <p className="text-sm text-slate-600 mt-1">
          Respond to customer inquiries about dish modifications
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Requests Yet
          </h3>
          <p className="text-slate-600">
            Customer requests will appear here when they have questions about your menu items.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingRequests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Pending Requests ({pendingRequests.length})
              </h3>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-xl border-2 border-yellow-200 p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">
                            {request.menu_item.name}
                          </h4>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-xs text-slate-500">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 mb-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Customer Request:
                      </div>
                      <p className="text-sm text-slate-900">{request.request_details}</p>
                    </div>

                    {request.customer_profile && (
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Customer Allergens:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[
                            ...request.customer_profile.dietary_restrictions,
                            ...request.customer_profile.custom_allergens,
                          ].map((allergen) => (
                            <span
                              key={allergen}
                              className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full"
                            >
                              {allergen}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedRequest?.id === request.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={response}
                          onChange={(e) => setResponse(e.target.value)}
                          placeholder="Type your response to the customer..."
                          rows={4}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespond(request.id, 'approved')}
                            disabled={responding}
                            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRespond(request.id, 'declined')}
                            disabled={responding}
                            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(null);
                              setResponse('');
                            }}
                            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Respond to Request
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {respondedRequests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-600" />
                Previous Requests ({respondedRequests.length})
              </h3>
              <div className="space-y-3">
                {respondedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-xl border border-slate-200 p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">
                            {request.menu_item.name}
                          </h4>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-xs text-slate-500">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 mb-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Customer Request:
                      </div>
                      <p className="text-sm text-slate-900">{request.request_details}</p>
                    </div>

                    {request.chef_response && (
                      <div
                        className={`rounded-lg p-4 ${
                          request.status === 'approved'
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Your Response:
                        </div>
                        <p className="text-sm text-slate-900">{request.chef_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
