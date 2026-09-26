package com.bookorbit.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bookorbit.ui.theme.WarningOrange

@Composable
fun ServerSetupScreen(
    onConnected: () -> Unit,
    modifier: Modifier = Modifier,
    vm: ServerSetupViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    var url by rememberSaveable { mutableStateOf(vm.currentServerUrl.orEmpty()) }
    val isInsecure = url.trim().startsWith("http://", ignoreCase = true)
    val clipboard = LocalClipboardManager.current

    fun submit() = vm.connect(url, onConnected)

    Column(
        modifier = modifier
            .fillMaxSize()
            .imePadding()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("BookOrbit Diagnostic", style = androidx.compose.material3.MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(8.dp))
        Text(
            "Enter your server URL",
            style = androidx.compose.material3.MaterialTheme.typography.bodyLarge,
            color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = url,
            onValueChange = { url = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { Text("http://192.168.x.x:3000") },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Uri,
                imeAction = ImeAction.Go,
                autoCorrectEnabled = false,
            ),
            keyboardActions = KeyboardActions(onGo = { submit() }),
        )

        if (isInsecure) {
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    Icons.Outlined.WarningAmber,
                    contentDescription = null,
                    tint = WarningOrange,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Insecure HTTP connection. Fine for this local diagnostic test.",
                    color = WarningOrange,
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
                )
            }
        }

        ui.error?.let { error ->
            Spacer(Modifier.height(12.dp))
            SelectionContainer {
                Text(
                    error,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Start,
                    modifier = Modifier.fillMaxWidth(),
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
                )
            }
            TextButton(
                onClick = { clipboard.setText(AnnotatedString(error)) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Copy diagnostic")
            }
        }

        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { submit() },
            enabled = !ui.loading && url.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (ui.loading) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
            } else {
                Text("Connect")
            }
        }
    }
}
