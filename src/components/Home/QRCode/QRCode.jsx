import { useEffect, useState } from "react";
import { QrCode, X } from "lucide-react";
import { createPortal } from "react-dom";
import QRCodeGenerator from "qrcode";
import "./QRCode.css";

export default function QRCode({ isRunning, serverUrl }) {
  const [isOpen, setIsOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isRunning) {
      setIsOpen(false);
    }
  }, [isRunning]);

  useEffect(() => {
    let active = true;
    setQrCode("");
    setError("");

    if (!isOpen || !isRunning || !serverUrl) {
      return () => {
        active = false;
      };
    }

    QRCodeGenerator.toDataURL(serverUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 192
    })
      .then((dataUrl) => {
        if (active) {
          setQrCode(dataUrl);
        }
      })
      .catch((qrGenerationError) => {
        if (active) {
          setError(`Não foi possível gerar o QR Code: ${qrGenerationError.message}`);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, isRunning, serverUrl]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const appShell = document.querySelector(".app-shell");
  const qrDialog = isOpen && isRunning && serverUrl
    ? (
      <div
        className="home-qr-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsOpen(false);
          }
        }}
      >
        <section
          className="home-qr-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-qr-title"
        >
          <button
            className="home-qr-close"
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Fechar QR Code"
            title="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <h2 id="home-qr-title">Acesse pelo celular</h2>
          <p>Conecte o celular à mesma rede Wi-Fi e escaneie este código para abrir o servidor no navegador.</p>
          {qrCode ? (
            <img src={qrCode} alt={`QR Code para abrir ${serverUrl} no celular`} />
          ) : (
            <div className="home-qr-placeholder" role={error ? "alert" : "status"}>
              {error || "Gerando QR Code..."}
            </div>
          )}
        </section>
      </div>
    )
    : null;

  return (
    <>
      <button
        className="home-qr-toggle"
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!isRunning || !serverUrl}
        aria-label={isRunning ? "Mostrar QR Code para acessar pelo celular" : "QR Code disponível quando o servidor estiver ligado"}
        title={isRunning ? "Mostrar QR Code" : "Ligue o servidor para usar o QR Code"}
      >
        <QrCode size={25} aria-hidden="true" />
      </button>
      {qrDialog && appShell && createPortal(qrDialog, appShell)}
    </>
  );
}
