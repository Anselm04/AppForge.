import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:appforge_mobile/main.dart' as shell;

void main() {
  testWidgets('trusted scaffold shell mounts with no claimed business UI', (
    tester,
  ) async {
    shell.main();
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
