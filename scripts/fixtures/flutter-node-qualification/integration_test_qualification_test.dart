import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:http/http.dart' as http;
import 'package:appforge_mobile/api_client.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'explicit harness calls real Node API',
    (tester) async {
      final api = ApiClient(
        Uri.parse(const String.fromEnvironment('API_BASE_URL')),
        http.Client(),
      );
      addTearDown(api.close);
      String status = 'Not checked';
      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) => Scaffold(
              body: Column(
                children: [
                  const Text('Qualification harness — scaffold shell only'),
                  ElevatedButton(
                    onPressed: () async {
                      final result = await api.health();
                      setState(
                        () => status =
                            '${result['status']}:${result['apiVersion']}',
                      );
                    },
                    child: const Text('Check actual backend'),
                  ),
                  Text(status),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.tap(find.text('Check actual backend'));
      for (var i = 0; i < 100 && find.text('ok:1').evaluate().isEmpty; i++) {
        await tester.pump(const Duration(milliseconds: 100));
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }
      expect(find.text('ok:1'), findsOneWidget);
    },
    timeout: const Timeout(Duration(minutes: 5)),
  );
}
