import { useContext, useEffect, useState } from 'react';
import { Alert, Button, Snackbar } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { AppContext } from '../AppContext';
import type { OrderInfo } from '../services/IOrderService';

const TITLE_COUNT = /^\(\d+\) /;

const setTitleCount = (count: number) => {
  const base = document.title.replace(TITLE_COUNT, '');
  document.title = count > 0 ? `(${count}) ${base}` : base;
};

/** Announces orders that become ready during this session, with a toast and a tab-title count while the tab is hidden. */
export default function OrderReadyNotifier() {
  const { orders, t } = useContext(AppContext)!;
  const [prevOrders, setPrevOrders] = useState(orders);
  const [readyOrder, setReadyOrder] = useState<OrderInfo | null>(null);
  const [unseen, setUnseen] = useState(0);

  // Compare against the previous orders during render; orders restored from storage start as the baseline.
  if (orders !== prevOrders) {
    const previous = new Map(prevOrders.map(o => [o.orderId, o.status]));
    const newlyReady = orders.filter(o => {
      const before = previous.get(o.orderId);
      return o.status === 'Available' && before !== undefined && before !== 'Available' && before !== 'Failed';
    });
    setPrevOrders(orders);
    if (newlyReady.length > 0) {
      setReadyOrder(newlyReady[0]);
      if (document.hidden) setUnseen(n => n + newlyReady.length);
    }
  }

  useEffect(() => {
    setTitleCount(unseen);
  }, [unseen]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setUnseen(0); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      setTitleCount(0);
    };
  }, []);

  const label = readyOrder?.orderKeys?.[0];

  return (
    <Snackbar
      open={!!readyOrder}
      autoHideDuration={15000}
      onClose={(_, reason) => { if (reason !== 'clickaway') setReadyOrder(null); }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert
        severity="success"
        variant="filled"
        onClose={() => setReadyOrder(null)}
        action={readyOrder?.downloadUrl ? (
          <Button
            color="inherit"
            size="small"
            startIcon={<DownloadIcon />}
            href={readyOrder.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setReadyOrder(null)}
          >
            {t('download')}
          </Button>
        ) : undefined}
      >
        {t('orderReady')}{label ? `: ${label}` : ''}
      </Alert>
    </Snackbar>
  );
}
