import { useState } from 'react';
import { dummyBids } from './bidFixtures';

export default function BidList() {
  const [bids, setBids] = useState(dummyBids);
  const [selectedBid, setSelectedBid] = useState<any>(null);

  // Temporary function jab tak backend integration nahi hota
  const acceptBidAPI = (bidId: number, acknowledged = false) => {
    console.log(`Bid ${bidId} accepted. Acknowledged below fair: ${acknowledged}`);
    alert('Bid Accepted Successfully!');
    setSelectedBid(null);
  };

  const handleAcceptClick = (bid: any) => {
    if (bid.assessment === "BELOW_FAIR") {
      setSelectedBid(bid); // Opens warning modal
    } else {
      acceptBidAPI(bid.id, false); // Instant accept
    }
  };

  const getBadgeStyle = (assessment: string) => {
    switch (assessment) {
      case "BELOW_FAIR": 
        return { backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' };
      case "FAIR": 
        return { backgroundColor: '#dcfce3', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' };
      case "ABOVE_FAIR": 
        return { backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' };
      default: 
        return { backgroundColor: '#f3f4f6', color: '#374151', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' };
    }
  };

  return (
    <div style={{ padding: '20px 0' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>Marketplace Bids</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {bids.map((bid) => (
          <div key={bid.id} style={{ border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>{bid.crop}</h3>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>₹{bid.bid_price} <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 'normal' }}>/ quintal</span></div>
              </div>
              
              {bid.source_unavailable ? (
                <span style={getBadgeStyle("")}>⚠️ Price check unavailable</span>
              ) : bid.assessment === "NO_REFERENCE" ? (
                <span style={getBadgeStyle("")}>No price reference</span>
              ) : (
                <span style={getBadgeStyle(bid.assessment)}>
                  {bid.assessment.replace('_', ' ')} {bid.gap_pct !== 0 && `(${bid.gap_pct > 0 ? '+' : ''}${bid.gap_pct}%)`}
                </span>
              )}
            </div>
            
            {!bid.source_unavailable && bid.assessment !== "NO_REFERENCE" && (
              <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '12px' }}>
                <div>Reference Price: ₹{bid.reference_price}/qtl</div>
                {bid.stale && <div style={{ color: '#b91c1c', marginTop: '4px', fontWeight: '500' }}>⚠️ Warning: Reference price is older than 3 days.</div>}
              </div>
            )}

            <button 
              onClick={() => handleAcceptClick(bid)}
              style={{ padding: '10px 16px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', width: '100%', marginTop: '8px' }}
            >
              Accept Bid
            </button>
          </div>
        ))}
      </div>

      {/* WARNING MODAL FOR BELOW_FAIR */}
      {selectedBid && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ color: '#dc2626', margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 'bold' }}>⚠️ Below Market Warning</h3>
            <p style={{ margin: '0 0 16px 0', lineHeight: '1.5' }}>You are about to accept a bid that is <strong>{selectedBid.gap_pct}%</strong> below the current fair market reference.</p>
            
            <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Your Bid:</span> <strong>₹{selectedBid.bid_price}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Market Reference:</span> <strong>₹{selectedBid.reference_price}</strong></div>
            </div>
            
            <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '24px' }}>Reason: Proceeding will result in lower-than-average revenue for this crop.</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setSelectedBid(null)} style={{ flex: 1, padding: '10px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Cancel</button>
              <button onClick={() => acceptBidAPI(selectedBid.id, true)} style={{ flex: 1, padding: '10px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Accept anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}