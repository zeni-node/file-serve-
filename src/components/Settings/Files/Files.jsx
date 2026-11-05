import { useEffect, useState } from "react";
import { Folder, FolderOpen, LoaderCircle } from "lucide-react";
import "./Files.css";

export default function Files() {
  const [repositoryPath, setRepositoryPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!window.fileServer) {
      setLoading(false);
      setError("A seleção da pasta está disponível somente no aplicativo desktop.");
      return () => {
        active = false;
      };
    }

    window.fileServer
      .getRepositoryPath()
      .then((savedPath) => {
        if (active) {
          setRepositoryPath(savedPath);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(`Não foi possível carregar a pasta selecionada: ${requestError.message}`);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function selectDirectory() {
    if (!window.fileServer || selecting) {
      return;
    }

    setSelecting(true);
    setError("");

    try {
      const result = await window.fileServer.selectRepositoryDirectory();
      if (!result.canceled) {
        setRepositoryPath(result.repositoryPath);
      }
    } catch (requestError) {
      setError(`Não foi possível selecionar a pasta: ${requestError.message}`);
    } finally {
      setSelecting(false);
    }
  }

  return (
    <section className="home-module files-module" aria-labelledby="files-module-title">
      <header className="files-module-header">
        <div className="files-module-heading">
          <div className="files-module-title">
            <Folder size={25} aria-hidden="true" />
            <h2 id="files-module-title">Repositório local</h2>
          </div>
          <button
            className="files-module-select"
            type="button"
            onClick={selectDirectory}
            disabled={loading || selecting || !window.fileServer}
            aria-label="Selecionar pasta do repositório"
            title="Selecionar pasta"
          >
            {selecting ? (
              <LoaderCircle className="files-module-spinner" size={20} aria-hidden="true" />
            ) : (
              <FolderOpen size={22} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <p className="files-module-path" title={repositoryPath ?? undefined}>
        {loading
          ? "Carregando pasta..."
          : repositoryPath ?? "Selecione a pasta onde os arquivos serão armazenados."}
      </p>

      {error && (
        <p className="files-module-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
