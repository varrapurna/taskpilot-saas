'use client';

import { useEffect } from 'react';

const WIDGET_SRC =
  'https://d1h7xhvkv25xoi.cloudfront.net/widget?integrationId=aa85f918-7e01-46e5-9aa0-1e783d49be71&ingestBase=https%3A%2F%2Fmhleadsg.exploremira.com%2Fapi%2Fingestion';

export default function FormTest() {
  useEffect(() => {
    const iframe = document.createElement('iframe');
    iframe.src = WIDGET_SRC;
    iframe.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000;display:none;background:transparent;';
    iframe.setAttribute('allowtransparency', 'true');
    document.body.appendChild(iframe);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = 'Enquire Now!';
    tab.style.cssText =
      'position:fixed;top:50%;right:0;transform:translateY(-50%);' +
      'writing-mode:vertical-rl;background:#0d9488;color:#fff;border:0;' +
      'cursor:pointer;padding:18px 9px;font:600 15px/1 Inter,system-ui,sans-serif;' +
      'letter-spacing:.5px;border-radius:8px 0 0 8px;' +
      'box-shadow:-2px 2px 12px rgba(0,0,0,.35);z-index:2147482000;';
    document.body.appendChild(tab);

    window.MHLeadsEmbed = {
      open: function () {
        iframe.style.display = 'block';
        tab.style.display = 'none';
        document.body.style.overflow = 'hidden';
      },
      close: function () {
        iframe.style.display = 'none';
        tab.style.display = 'block';
        document.body.style.overflow = '';
      },
    };
    tab.onclick = window.MHLeadsEmbed.open;

    function onMessage(e) {
      if (e.data && e.data.type === 'MHL_EMBED_PREVIEW_CLOSE') {
        window.MHLeadsEmbed.close();
      }
    }
    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
      iframe.remove();
      tab.remove();
      document.body.style.overflow = '';
      delete window.MHLeadsEmbed;
    };
  }, []);

  return null;
}
