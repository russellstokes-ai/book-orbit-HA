package com.bookorbit.feature.auth

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bookorbit.core.auth.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ServerSetupViewModel @Inject constructor(
    private val session: SessionManager,
    private val repo: AuthRepository,
) : ViewModel() {

    data class UiState(val loading: Boolean = false, val error: String? = null)

    private val _ui = MutableStateFlow(UiState())
    val ui = _ui.asStateFlow()

    val currentServerUrl: String? get() = session.serverUrl

    /**
     * Diagnostic build:
     * - does not change global navigation state until setup-status succeeds
     * - preserves the exact exception chain on screen and in Logcat
     */
    fun connect(rawUrl: String, onConnected: () -> Unit) {
        val trimmed = rawUrl.trim().trimEnd('/')
        if (trimmed.isEmpty()) return

        _ui.update { it.copy(loading = true, error = null) }

        viewModelScope.launch {
            val previousUrl = session.setServerUrlForProbe(trimmed)
            try {
                val status = repo.setupStatus()
                Log.i("BookOrbitDiag", "Server probe succeeded url=$trimmed status=$status")

                // Navigate while the current setup NavHost is still active, then commit the
                // global SignedOut state. This removes the original state/navigation race.
                onConnected()
                session.setServerUrl(trimmed)
            } catch (e: Exception) {
                session.restoreServerUrlAfterProbe(previousUrl)

                val chain = generateSequence<Throwable>(e) { it.cause }
                    .take(5)
                    .joinToString(" -> ") { cause ->
                        val message = cause.message?.takeIf { it.isNotBlank() } ?: "(no message)"
                        "${cause.javaClass.simpleName}: $message"
                    }

                val diagnostic = buildString {
                    appendLine("Could not connect to BookOrbit.")
                    appendLine()
                    appendLine("URL: $trimmed")
                    appendLine("Error: $chain")
                }.trim()

                Log.e("BookOrbitDiag", diagnostic, e)
                _ui.update { it.copy(error = diagnostic) }
            } finally {
                _ui.update { it.copy(loading = false) }
            }
        }
    }
}
