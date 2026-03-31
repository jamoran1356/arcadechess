"use client";

import { useState, useEffect } from "react";
import { ArcadeGameType } from "@prisma/client";
import { DialogModal } from "@/components/dialog-modal";

interface ArcadeGame {
  id: string;
  name: string;
  description: string;
  gameType: ArcadeGameType;
  baseScore: number;
  difficultyMultiplier: string;
  isEnabled: boolean;
  contractAddresses: Record<string, string>;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export function ArcadeGamesAdminClient() {
  const [games, setGames] = useState<ArcadeGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArcadeGame | null>(null);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    title: string;
    description: string;
    tone: "default" | "success" | "danger" | "warning";
  } | null>(null);
  const [formData, setFormData] = useState<Partial<ArcadeGame>>({
    name: "",
    description: "",
    gameType: "TARGET_RUSH" as ArcadeGameType,
    baseScore: 1000,
    difficultyMultiplier: "1.0",
    isEnabled: true,
    contractAddresses: {
      INITIA: "",
      FLOW: "",
      SOLANA: "",
    },
    metadata: {},
  });

  // Fetch games
  useEffect(() => {
    fetchGames();
  }, []);

  async function fetchGames() {
    try {
      const res = await fetch("/api/admin/arcade-games");
      if (!res.ok) throw new Error("Failed to fetch games");
      const data = await res.json();
      setGames(data);
    } catch (error) {
      console.error("Error fetching games:", error);
      setFeedbackDialog({
        title: "No se pudieron cargar los juegos",
        description: "El backend respondió con error al pedir el catálogo arcade.",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      if (!formData.name || !formData.description) {
        setFeedbackDialog({
          title: "Datos incompletos",
          description: "El nombre y la descripción son obligatorios antes de guardar.",
          tone: "warning",
        });
        return;
      }

      const url = editingId
        ? `/api/admin/arcade-games?id=${editingId}`
        : "/api/admin/arcade-games";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save game");
      }

      const savedGame = await res.json();
      
      if (editingId) {
        setGames(games.map((g) => (g.id === editingId ? savedGame : g)));
        setFeedbackDialog({
          title: "Juego actualizado",
          description: "Los cambios quedaron guardados correctamente.",
          tone: "success",
        });
      } else {
        setGames([savedGame, ...games]);
        setFeedbackDialog({
          title: "Juego creado",
          description: "El nuevo minijuego ya forma parte del catálogo.",
          tone: "success",
        });
      }

      resetForm();
    } catch (error) {
      console.error("Error saving game:", error);
      setFeedbackDialog({
        title: "No se pudo guardar",
        description: error instanceof Error ? error.message : "El servidor rechazó la operación.",
        tone: "danger",
      });
    }
  }

  async function handleDelete(gameId: string) {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/admin/arcade-games?id=${gameId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete game");

      setGames(games.filter((g) => g.id !== gameId));
      setDeleteTarget(null);
      setFeedbackDialog({
        title: "Juego eliminado",
        description: "El minijuego se eliminó del panel de administración.",
        tone: "success",
      });
    } catch (error) {
      console.error("Error deleting game:", error);
      setFeedbackDialog({
        title: "No se pudo eliminar",
        description: error instanceof Error ? error.message : "La eliminación falló.",
        tone: "danger",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function handleEdit(game: ArcadeGame) {
    setEditingId(game.id);
    setFormData(game);
    setIsCreating(false);
  }

  function resetForm() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      name: "",
      description: "",
      gameType: "TARGET_RUSH" as ArcadeGameType,
      baseScore: 1000,
      difficultyMultiplier: "1.0",
      isEnabled: true,
      contractAddresses: {
        INITIA: "",
        FLOW: "",
        SOLANA: "",
      },
      metadata: {},
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Arcade Games</h2>
          <p className="text-sm text-slate-400">Manage arcade minigames and their onchain configurations</p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            + Create Game
          </button>
        )}
      </div>

      {/* Form */}
      {(isCreating || editingId) && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h3 className="mb-6 text-lg font-semibold text-slate-100">
            {editingId ? "Edit Game" : "Create New Game"}
          </h3>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="e.g., Target Rush"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Game Type
              </label>
              <select
                value={formData.gameType || "TARGET_RUSH"}
                onChange={(e) =>
                  setFormData({ ...formData, gameType: e.target.value as ArcadeGameType })
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="TARGET_RUSH">Target Rush</option>
                <option value="MEMORY_GRID">Memory Grid</option>
                <option value="KEY_CLASH">Key Clash</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="Describe the game..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Base Score
              </label>
              <input
                type="number"
                min="1"
                value={formData.baseScore || 1000}
                onChange={(e) =>
                  setFormData({ ...formData, baseScore: parseInt(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Difficulty Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={formData.difficultyMultiplier || "1.0"}
                onChange={(e) =>
                  setFormData({ ...formData, difficultyMultiplier: e.target.value })
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <h4 className="mb-4 text-sm font-semibold text-slate-200">Contract Addresses</h4>
              <div className="grid gap-3 md:grid-cols-3">
                {["INITIA", "FLOW", "SOLANA"].map((network) => (
                  <div key={network}>
                    <label className="block text-sm text-slate-300 mb-1">{network}</label>
                    <input
                      type="text"
                      placeholder={`${network} contract address`}
                      value={
                        (formData.contractAddresses as Record<string, string>)?.[network] || ""
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contractAddresses: {
                            ...(formData.contractAddresses as Record<string, string>),
                            [network]: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 text-sm placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.isEnabled ?? true}
                onChange={(e) =>
                  setFormData({ ...formData, isEnabled: e.target.checked })
                }
                className="h-4 w-4"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-slate-300">
                Enabled
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              {editingId ? "Update" : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Games Table */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
        {games.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400">No arcade games yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-700 bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">
                    Game
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">
                    Base Score
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr
                    key={game.id}
                    className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-100">{game.name}</p>
                        <p className="text-sm text-slate-400">
                          {game.description.substring(0, 50)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{game.gameType}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{game.baseScore}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          game.isEnabled
                            ? "bg-emerald-900/30 text-emerald-300"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {game.isEnabled ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(game)}
                          className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(game)}
                          className="text-sm text-red-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DialogModal
        open={Boolean(deleteTarget)}
        title="Eliminar minijuego"
        description={deleteTarget ? `Vas a borrar ${deleteTarget.name}. Esta acción no se puede deshacer.` : ""}
        tone="danger"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        isBusy={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget.id) : undefined}
      />

      <DialogModal
        open={Boolean(feedbackDialog)}
        title={feedbackDialog?.title ?? "Mensaje"}
        description={feedbackDialog?.description}
        tone={feedbackDialog?.tone ?? "default"}
        confirmLabel="Entendido"
        hideCancel
        onClose={() => setFeedbackDialog(null)}
      />
    </div>
  );
}
